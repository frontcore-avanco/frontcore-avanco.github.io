// -----------------------------------------------------------------------
// motor.js — o trabalho pesado do Recuperador, dentro de um Web Worker.
//
// Tudo acontece em arquivos temporários no disco do navegador (OPFS), numa
// CÓPIA do banco escolhido: o arquivo original nunca é aberto pra escrita
// (o navegador só lê ele, em pedaços, pra fazer a cópia de trabalho).
//
// Procedimento "clone" (o mesmo do `.clone` do sqlite3, descrito no manual
// de suporte): cria um banco novo com a mesma estrutura e copia os dados
// tabela a tabela. Se uma tabela tem área danificada, copia o que é
// legível a partir do começo e depois a partir do fim ("leitura parcial").
//
// Detalhe importante: o banco danificado é lido numa conexão e o banco novo
// é gravado em OUTRA. Se a leitura e a gravação ficassem na mesma conexão
// (ATTACH), o primeiro erro de corrupção inutilizaria a conexão inteira e
// nada mais seria copiado — foi o que aconteceu nos primeiros testes.
// -----------------------------------------------------------------------
import sqlite3InitModule from "../vendor/sqlite-wasm/index.mjs";

const ORIGEM = "/origem.db";
const DESTINO = "/recuperado.db";
const TAMANHO_PEDACO = 8 * 1024 * 1024;
const LINHAS_POR_COMMIT = 500;
const ROWID_MIN = -9223372036854775808n;

let sqlite3 = null;
let pool = null;
let origem = null;
let destino = null;
let emitir = () => {};

export function ligar(funcao) {
  emitir = funcao;
}

function log(nivel, texto) {
  emitir({ tipo: "log", nivel, texto, hora: Date.now() });
}

function progresso(dados) {
  emitir({ tipo: "progresso", ...dados });
}

const q = (nome) => `"${String(nome).replace(/"/g, '""')}"`;

function ehCorrupcao(e) {
  const rc = (e && e.resultCode ? e.resultCode : 0) & 0xff;
  return rc === 11 || rc === 26 || rc === 10 || /malformed|corrupt|not a database|disk i\/o/i.test(String((e && e.message) || ""));
}

function lerPragma(db, nome) {
  let valor;
  db.exec({ sql: `PRAGMA ${nome}`, rowMode: "array", callback: (linha) => (valor = linha[0]) });
  return valor;
}

// ---- ciclo de vida ------------------------------------------------------
export async function iniciar() {
  if (sqlite3) return;
  sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: (m) => log("aviso", String(m)) });
  pool = await sqlite3.installOpfsSAHPoolVfs({ clearOnInit: true, initialCapacity: 10 });
  log("info", `Motor SQLite ${sqlite3.version.libVersion} carregado. Tudo roda neste computador; nada é enviado a servidor.`);
}

function fecharBancos() {
  for (const db of [origem, destino]) {
    try {
      if (db && db.isOpen()) db.close();
    } catch {
      /* já fechado */
    }
  }
  origem = null;
  destino = null;
}

export async function limpar() {
  fecharBancos();
  if (!pool) return;
  for (const nome of pool.getFileNames()) {
    try {
      pool.unlink(nome);
    } catch {
      /* segue */
    }
  }
}

// ---- 1. copiar o banco escolhido pra área de trabalho ------------------------
export async function importar(arquivo) {
  await iniciar();
  await limpar();
  log("info", `Copiando "${arquivo.name}" (${(arquivo.size / 1048576).toFixed(1)} MB) pra uma área de trabalho temporária. O arquivo original não é alterado.`);

  let posicao = 0;
  try {
    await pool.importDb(ORIGEM, async () => {
      if (posicao >= arquivo.size) return undefined;
      const fim = Math.min(posicao + TAMANHO_PEDACO, arquivo.size);
      const pedaco = new Uint8Array(await arquivo.slice(posicao, fim).arrayBuffer());
      posicao = fim;
      progresso({ fase: "importar", feito: posicao, total: arquivo.size });
      return pedaco;
    });
  } catch (e) {
    throw new Error(`O arquivo não pôde ser importado como banco SQLite (${e.message}). O cabeçalho pode estar danificado.`);
  }

  // confere se a cópia ficou do tamanho do original (já vimos uma cópia
  // truncada em silêncio uma vez; melhor parar do que recuperar pela metade)
  const bd = new pool.OpfsSAHPoolDb(ORIGEM);
  try {
    const tamPagina = Number(lerPragma(bd, "page_size"));
    const paginas = Number(lerPragma(bd, "page_count"));
    const esperado = Math.floor(arquivo.size / tamPagina);
    if (paginas !== esperado) {
      throw new Error(`A cópia de trabalho ficou incompleta (${paginas} de ${esperado} páginas). Tente de novo; se repetir, feche outras abas do FrontCore e recarregue esta página.`);
    }
  } finally {
    bd.close();
  }
  log("ok", "Cópia de trabalho criada e conferida.");
}

// ---- 2. identificar e diagnosticar ----------------------------------------------
export function diagnosticar() {
  origem = new pool.OpfsSAHPoolDb(ORIGEM);
  const resultado = { tabelas: [], integridade: { ok: false, mensagens: [], erro: null }, paginaUm: true, erroEstrutura: null };

  try {
    resultado.tabelas = origem.selectValues("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  } catch (e) {
    resultado.paginaUm = false;
    resultado.erroEstrutura = e.message;
    log("erro", `Não foi possível ler a estrutura do banco: ${e.message}`);
    return resultado;
  }
  log("info", `Estrutura lida: ${resultado.tabelas.length} tabela(s) — ${resultado.tabelas.join(", ") || "nenhuma"}.`);

  log("info", "Verificando a integridade do banco (pode levar alguns segundos)...");
  const stmt = origem.prepare("PRAGMA integrity_check");
  try {
    while (stmt.step()) resultado.integridade.mensagens.push(String(stmt.get(0)));
  } catch (e) {
    resultado.integridade.erro = e.message;
  } finally {
    stmt.finalize();
  }
  const msgs = resultado.integridade.mensagens;
  resultado.integridade.ok = !resultado.integridade.erro && msgs.length === 1 && msgs[0] === "ok";
  if (resultado.integridade.ok) {
    log("ok", "Verificação de integridade: ok. Este banco não apresenta corrupção.");
  } else {
    log("aviso", "Verificação de integridade encontrou problemas:");
    for (const m of msgs.slice(0, 10)) log("aviso", `  ${m.replace(/\n/g, " ")}`);
    if (resultado.integridade.erro) log("aviso", `  Erro: ${resultado.integridade.erro}`);
  }
  return resultado;
}

// ---- 3. recuperar ----------------------------------------------------------------------
function infoColunas(nome) {
  const info = origem.selectObjects(`PRAGMA table_xinfo(${q(nome)})`);
  const colunas = info.filter((c) => c.hidden === 0);
  const chaves = info.filter((c) => c.pk > 0);
  const aliasRowid = chaves.length === 1 && /^integer$/i.test(String(chaves[0].type || ""));
  return { nomes: colunas.map((c) => c.name), aliasRowid };
}

/** Lê o que for possível de `sel` e grava em `ins`, linha a linha. Para no
 * primeiro erro de corrupção da LEITURA; erros de gravação sobem. */
function transferir(sel, ins, bindCompleto, aoLer) {
  let copiadas = 0;
  let ultimoRowid = null;
  let erro = null;
  const colunas = sel.columnCount;
  try {
    for (;;) {
      let valores;
      try {
        if (!sel.step()) break;
        valores = new Array(colunas);
        for (let i = 0; i < colunas; i++) valores[i] = sel.get(i);
      } catch (e) {
        if (!ehCorrupcao(e)) throw e;
        erro = e;
        break;
      }
      ultimoRowid = valores[0];
      ins.bind(bindCompleto ? valores : valores.slice(1)).stepReset();
      copiadas++;
      if (copiadas % LINHAS_POR_COMMIT === 0) {
        destino.exec("COMMIT; BEGIN");
        if (aoLer) aoLer(copiadas);
      }
    }
  } finally {
    sel.finalize();
  }
  return { copiadas, ultimoRowid, erro };
}

function copiarTabela(tabela) {
  const nome = tabela.name;
  const tq = q(nome);
  const semRowid = /WITHOUT\s+ROWID/i.test(tabela.sql || "");
  const { nomes, aliasRowid } = infoColunas(nome);
  const lista = nomes.map(q).join(",");
  // com rowid: o 1º valor lido é o rowid. Tabela com INTEGER PRIMARY KEY já
  // tem o rowid dentro da própria coluna (não vai explícito no INSERT).
  const insereRowid = !semRowid && !aliasRowid;
  const ins = destino.prepare(
    `INSERT OR IGNORE INTO main.${tq}(${insereRowid ? "rowid," : ""}${lista}) VALUES(${(insereRowid ? ["?"] : []).concat(nomes.map(() => "?")).join(",")})`
  );
  const bindCompleto = semRowid || insereRowid;
  const relatorio = { nome, metodo: "direto", detalhe: "" };
  const aoLer = (n) => progresso({ fase: "recuperar", tabela: nome, linhas: n });

  try {
    const selDireto = origem.prepare(semRowid ? `SELECT ${lista} FROM ${tq}` : `SELECT rowid,${lista} FROM ${tq} ORDER BY rowid`);
    const inicio = transferir(selDireto, ins, bindCompleto, aoLer);
    if (!inicio.erro) return relatorio;

    relatorio.metodo = "parcial";
    log("aviso", `Tabela ${nome}: a leitura parou em área danificada após ${inicio.copiadas} linha(s) (${inicio.erro.message}). Tentando pelo fim da tabela.`);
    if (semRowid) {
      relatorio.detalhe = `leitura pelo começo: ${inicio.copiadas} linha(s); tabela WITHOUT ROWID não permite leitura pelo fim`;
      return relatorio;
    }

    const limite = inicio.ultimoRowid === null ? ROWID_MIN : inicio.ultimoRowid;
    const selFim = origem.prepare(`SELECT rowid,${lista} FROM ${tq} WHERE rowid>? ORDER BY rowid DESC`);
    selFim.bind([limite]);
    const fim = transferir(selFim, ins, bindCompleto, aoLer);
    relatorio.detalhe = `leitura pelo começo: ${inicio.copiadas} linha(s); pelo fim: ${fim.copiadas} linha(s)`;
    return relatorio;
  } finally {
    ins.finalize();
  }
}

export function recuperar() {
  const inicio = Date.now();
  if (!origem || !origem.isOpen()) origem = new pool.OpfsSAHPoolDb(ORIGEM);
  if (destino && destino.isOpen()) destino.close();
  try {
    pool.unlink(DESTINO);
  } catch {
    /* ainda não existia */
  }

  const tamanhoPagina = Number(lerPragma(origem, "page_size"));
  const autoVacuum = Number(lerPragma(origem, "auto_vacuum"));
  const versaoUsuario = Number(lerPragma(origem, "user_version"));
  const idAplicacao = Number(lerPragma(origem, "application_id"));
  const codificacao = String(lerPragma(origem, "encoding") || "UTF-8");
  const objetos = origem.selectObjects("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid");
  const tabelas = objetos.filter((o) => o.type === "table" && !/^sqlite_/i.test(o.name));
  const outros = objetos.filter((o) => o.type !== "table");
  log("info", `Estrutura do original: ${tabelas.length} tabela(s) e ${outros.length} índice(s)/gatilho(s)/visão(ões).`);

  log("info", `Criando o banco novo (página ${tamanhoPagina} bytes, ${codificacao}, mesmas configurações do original).`);
  destino = new pool.OpfsSAHPoolDb(DESTINO);
  destino.exec("PRAGMA temp_store=MEMORY");
  if (/^[A-Za-z0-9-]+$/.test(codificacao)) destino.exec(`PRAGMA encoding='${codificacao}'`);
  destino.exec(`PRAGMA page_size=${tamanhoPagina}`);
  destino.exec(`PRAGMA auto_vacuum=${autoVacuum}`);

  const relatorios = [];
  destino.exec("BEGIN");
  try {
    for (const t of tabelas) destino.exec(t.sql);
    log("info", "Estrutura criada no banco novo. Copiando os dados tabela a tabela...");

    for (let i = 0; i < tabelas.length; i++) {
      const t = tabelas[i];
      progresso({ fase: "recuperar", tabela: t.name, indice: i, total: tabelas.length });
      log("info", `Copiando tabela ${t.name} (${i + 1}/${tabelas.length})...`);
      const rel = copiarTabela(t);
      destino.exec("COMMIT; BEGIN");
      rel.linhas = destino.selectValue(`SELECT count(*) FROM main.${q(t.name)}`);
      if (rel.metodo === "direto") log("ok", `Tabela ${t.name}: ${rel.linhas} linha(s) copiada(s) (cópia completa).`);
      else log("aviso", `Tabela ${t.name}: ${rel.linhas} linha(s) recuperada(s) por leitura parcial (${rel.detalhe}).`);
      relatorios.push(rel);
    }
    progresso({ fase: "recuperar", indice: tabelas.length, total: tabelas.length });

    if (origem.selectValue("SELECT count(*) FROM sqlite_master WHERE name='sqlite_sequence'") > 0) {
      try {
        const sequencias = origem.selectArrays("SELECT name, seq FROM sqlite_sequence");
        for (const [nomeTab, seq] of sequencias) destino.exec({ sql: "INSERT OR REPLACE INTO main.sqlite_sequence(name, seq) VALUES(?,?)", bind: [nomeTab, seq] });
        log("info", "Contadores de sequência (AUTOINCREMENT) preservados.");
      } catch (e) {
        log("aviso", `Não foi possível copiar sqlite_sequence: ${e.message}`);
      }
    }

    for (const o of outros) {
      try {
        destino.exec(o.sql);
        log("info", `${o.type} ${o.name} recriado.`);
      } catch (e) {
        log("aviso", `${o.type} ${o.name} não pôde ser recriado: ${e.message}`);
      }
    }
    destino.exec("COMMIT");
  } catch (e) {
    try {
      destino.exec("ROLLBACK");
    } catch {
      /* já encerrada */
    }
    throw e;
  }

  destino.exec(`PRAGMA user_version=${versaoUsuario}`);
  destino.exec(`PRAGMA application_id=${idAplicacao}`);
  log("ok", `Cópia concluída em ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
  return { relatorios, segundos: (Date.now() - inicio) / 1000 };
}

// ---- 4. validar --------------------------------------------------------------------------------
export function validar(relatorios) {
  log("info", "Validando o banco novo: verificação de integridade completa...");
  const mensagens = [];
  const stmt = destino.prepare("PRAGMA integrity_check");
  try {
    while (stmt.step()) mensagens.push(String(stmt.get(0)));
  } finally {
    stmt.finalize();
  }
  const integro = mensagens.length === 1 && mensagens[0] === "ok";
  if (integro) log("ok", "Integridade do banco novo: ok.");
  else for (const m of mensagens.slice(0, 10)) log("erro", `  ${m}`);

  const tabelas = relatorios.map((r) => {
    const linhas = destino.selectValue(`SELECT count(*) FROM main.${q(r.nome)}`);
    return { nome: r.nome, linhas, metodo: r.metodo, detalhe: r.detalhe };
  });

  let veredito;
  if (!integro) veredito = "falha";
  else if (tabelas.some((t) => t.metodo !== "direto")) veredito = "ressalvas";
  else veredito = "integro";
  return { integro, mensagens, tabelas, veredito };
}

// ---- 5. entregar o banco novo ------------------------------------------------------------------
export function exportar() {
  if (destino && destino.isOpen()) destino.close();
  destino = null;
  const bytes = pool.exportFile(DESTINO);
  log("info", `Banco recuperado pronto pra salvar (${(bytes.byteLength / 1048576).toFixed(1)} MB).`);
  return bytes;
}
