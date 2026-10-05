// -----------------------------------------------------------------------
// app.js — interface do Recuperador de Banco de Dados.
// Fluxo: Selecionar banco → Identificar → Recuperar → Validar → Gerar banco
// corrigido. O trabalho pesado roda no Worker (motor.js); aqui só ficam a
// tela, o registro das etapas e o salvamento do arquivo novo.
// -----------------------------------------------------------------------
import { lerCabecalho } from "./cabecalho.js";
import { identificarBanco, PROCEDIMENTOS } from "./perfis.js";

const $ = (id) => document.getElementById(id);

const estado = {
  arquivo: null,
  cabecalho: null,
  perfil: null,
  diagnostico: null,
  recuperacao: null,
  validacao: null,
  bytes: null, // banco corrigido, guardado pra tentar salvar de novo sem refazer
  ocupado: false,
  salvo: false,
};

const linhasLog = [];

// ---- registro ------------------------------------------------------------------
function hora(ts) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour12: false });
}

function registrar(nivel, texto, ts = Date.now()) {
  linhasLog.push({ nivel, texto, ts });
  const area = $("log");
  if (linhasLog.length === 1) area.textContent = "";
  const linha = document.createElement("div");
  const h = document.createElement("span");
  h.className = "l-hora";
  h.textContent = `[${hora(ts)}] `;
  const t = document.createElement("span");
  if (nivel !== "info") t.className = `l-${nivel}`;
  t.textContent = texto;
  linha.append(h, t);
  area.append(linha);
  area.scrollTop = area.scrollHeight;
}

function textoRegistro() {
  let usuario = "";
  try {
    usuario = JSON.parse(sessionStorage.getItem("frontcore_usuario") || "{}").nome || "";
  } catch {
    /* sem usuário no registro */
  }
  const cab = [
    "FrontCore — Recuperador de Banco de Dados",
    `Data: ${new Date().toLocaleString("pt-BR")}`,
    usuario ? `Usuário: ${usuario}` : null,
    estado.arquivo ? `Arquivo: ${estado.arquivo.name} (${estado.arquivo.size} bytes)` : null,
    estado.perfil ? `Banco identificado: ${estado.perfil.nome}` : null,
    "",
  ].filter((l) => l !== null);
  const corpo = linhasLog.map((l) => `[${hora(l.ts)}] [${l.nivel.toUpperCase()}] ${l.texto}`);
  return cab.concat(corpo).join("\r\n") + "\r\n";
}

function baixarTexto(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---- worker ----------------------------------------------------------------------
let worker = null;
let seq = 0;
const pendentes = new Map();
let aoProgresso = () => {};

function garantirWorker() {
  if (worker) return worker;
  worker = new Worker("js/worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.id) {
      const p = pendentes.get(data.id);
      pendentes.delete(data.id);
      if (!p) return;
      if (data.ok) p.res(data.resultado);
      else p.rej(new Error(data.erro));
    } else if (data.tipo === "log") {
      registrar(data.nivel, data.texto, data.hora);
    } else if (data.tipo === "progresso") {
      aoProgresso(data);
    }
  };
  worker.onerror = (e) => {
    const erro = new Error(`Falha no motor de recuperação${e.message ? `: ${e.message}` : ""}`);
    for (const p of pendentes.values()) p.rej(erro);
    pendentes.clear();
    worker = null;
  };
  return worker;
}

function comando(nome, args) {
  return new Promise((res, rej) => {
    const id = ++seq;
    pendentes.set(id, { res, rej });
    garantirWorker().postMessage({ id, comando: nome, args });
  });
}

// ---- interface -----------------------------------------------------------------------
function marcarTrilha(passo, situacao) {
  const li = document.querySelector(`#trilha [data-passo="${passo}"]`);
  if (li) li.className = situacao || "";
}

function resetarTrilha(atual) {
  for (const li of document.querySelectorAll("#trilha li")) li.className = "";
  marcarTrilha(atual, "atual");
}

function barra(id, fracao) {
  const b = $(id);
  b.hidden = false;
  if (fracao === "indeterminada") {
    b.classList.add("indeterminada");
    b.firstElementChild.style.width = "";
  } else {
    b.classList.remove("indeterminada");
    b.firstElementChild.style.width = `${Math.round(Math.max(0, Math.min(1, fracao)) * 100)}%`;
  }
}

function habilitar(id, sim) {
  $(id).disabled = !sim;
}

function bloquear(sim) {
  estado.ocupado = sim;
  for (const id of ["btn-arquivo", "btn-identificar", "btn-recuperar", "btn-salvar"]) {
    $(id).dataset.ocupado = sim ? "1" : "";
    if (sim) $(id).disabled = true;
  }
}

function mostrarCartao(id, classe, html) {
  const c = $(id);
  c.className = `cartao ${classe || ""}`;
  c.innerHTML = html;
  c.hidden = false;
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mb = (n) => `${(n / 1048576).toFixed(1).replace(".", ",")} MB`;
const milhar = (n) => Number(n).toLocaleString("pt-BR");

function resetarTudo() {
  Object.assign(estado, { cabecalho: null, perfil: null, diagnostico: null, recuperacao: null, validacao: null, bytes: null, salvo: false });
  for (const id of ["passo-identificar", "passo-recuperar", "passo-validar", "passo-gerar"]) $(id).disabled = true;
  for (const id of ["resultado-identificar", "resultado-validar"]) $(id).hidden = true;
  for (const id of ["barra-identificar", "barra-recuperar"]) $(id).hidden = true;
  for (const id of ["info-identificar", "info-recuperar", "info-salvar"]) $(id).textContent = "";
  $("info-validar").textContent = "A validação roda sozinha ao fim da recuperação.";
  linhasLog.length = 0;
  $("log").textContent = "O registro aparece aqui quando você começar.";
  resetarTrilha("selecionar");
}

// ---- 1. selecionar ----------------------------------------------------------------------
async function aoEscolherArquivo(arquivo) {
  if (!arquivo) return;
  resetarTudo();
  if (worker) comando("limpar").catch(() => {});
  estado.arquivo = arquivo;
  $("info-arquivo").textContent = `${arquivo.name} — ${mb(arquivo.size)}`;
  registrar("info", `Arquivo selecionado: ${arquivo.name} (${mb(arquivo.size)}).`);
  marcarTrilha("selecionar", "feito");
  marcarTrilha("identificar", "atual");
  $("passo-identificar").disabled = false;
  habilitar("btn-identificar", true);
}

// ---- 2. identificar -----------------------------------------------------------------------
async function identificar() {
  const arquivo = estado.arquivo;
  bloquear(true);
  $("resultado-identificar").hidden = true;
  barra("barra-identificar", 0);
  $("barra-identificar").hidden = false;
  try {
    $("info-identificar").textContent = "Lendo o cabeçalho do arquivo...";
    const cab = lerCabecalho(await arquivo.slice(0, 100).arrayBuffer(), arquivo.size);
    estado.cabecalho = cab;
    if (!cab.sqlite) {
      registrar("erro", "O arquivo não tem o cabeçalho de um banco SQLite. Não é possível recuperar por aqui.");
      mostrarCartao(
        "resultado-identificar",
        "erro",
        "<h3>Não é um banco SQLite</h3><p>O início do arquivo não corresponde a um banco SQLite (o cabeçalho está destruído ou o arquivo é de outro tipo). Confira se escolheu o arquivo certo.</p>"
      );
      marcarTrilha("identificar", "erro");
      return;
    }
    registrar(
      "info",
      `Cabeçalho: SQLite, páginas de ${cab.tamanhoPagina} bytes, ${cab.paginasNoArquivo} página(s) no arquivo (o cabeçalho declara ${cab.paginasNoCabecalho}), codificação ${cab.codificacao}.`
    );
    if (cab.truncado) registrar("aviso", "O arquivo é menor do que o banco declara: a cópia foi interrompida ou o arquivo foi cortado.");
    if (cab.modoWal) registrar("aviso", "O banco usa modo WAL: dados recentes podem estar num arquivo -wal que não foi copiado junto.");

    aoProgresso = (p) => {
      if (p.fase === "importar") {
        barra("barra-identificar", p.feito / p.total);
        $("info-identificar").textContent = `Copiando para a área de trabalho... ${Math.round((p.feito / p.total) * 100)}%`;
      }
    };
    $("info-identificar").textContent = "Copiando para a área de trabalho...";
    await comando("importar", { arquivo });

    barra("barra-identificar", "indeterminada");
    $("info-identificar").textContent = "Lendo a estrutura e verificando a integridade (pode levar um tempo em bancos grandes)...";
    const diag = await comando("diagnosticar");
    estado.diagnostico = diag;

    const { perfil, motivo } = identificarBanco(arquivo.name, diag.tabelas);
    estado.perfil = perfil;
    registrar(perfil ? "ok" : "aviso", perfil ? `Banco identificado: ${perfil.nome}. ${motivo}` : `Banco não identificado. ${motivo} Será aplicado o procedimento padrão.`);

    mostrarCartao("resultado-identificar", classeIdentificacao(diag), htmlIdentificacao(cab, perfil, motivo, diag));
    $("info-identificar").textContent = "Análise concluída.";
    marcarTrilha("identificar", "feito");
    marcarTrilha("recuperar", "atual");
    $("passo-recuperar").disabled = false;
    habilitar("btn-recuperar", true);
    $("info-recuperar").textContent = diag.integridade.ok
      ? "O banco não apresenta corrupção; ainda assim é possível gerar uma cópia reconstruída."
      : "Pronto para recuperar.";
  } catch (e) {
    registrar("erro", `Falha ao analisar o banco: ${e.message}`);
    mostrarCartao("resultado-identificar", "erro", `<h3>Não foi possível analisar o banco</h3><p>${esc(e.message)}</p>`);
    marcarTrilha("identificar", "erro");
  } finally {
    aoProgresso = () => {};
    $("barra-identificar").hidden = true;
    bloquear(false);
    reabilitar();
  }
}

function classeIdentificacao(diag) {
  if (!diag.paginaUm) return "erro";
  return diag.integridade.ok ? "ok" : "ressalva";
}

function htmlIdentificacao(cab, perfil, motivo, diag) {
  const partes = [];
  if (!diag.paginaUm) {
    partes.push(`<h3>Estrutura do banco ilegível</h3><p>${esc(diag.erroEstrutura)}</p>`);
  } else if (diag.integridade.ok) {
    partes.push("<h3>Banco íntegro</h3><p>A verificação de integridade retornou <code>ok</code> — não foi encontrada corrupção.</p>");
  } else {
    partes.push("<h3>Corrupção encontrada</h3><p>A verificação de integridade apontou problemas (detalhes abaixo e no registro).</p>");
  }
  const dl = [
    ["Banco", perfil ? `${esc(perfil.nome)} — ${esc(perfil.descricao)}` : "Não reconhecido (será usado o procedimento padrão)"],
    ["Como foi reconhecido", esc(motivo)],
    ["Procedimento", esc(PROCEDIMENTOS[perfil ? perfil.procedimento : "clone"])],
    ["Tamanho", `${mb(cab.tamanhoArquivo)} · páginas de ${cab.tamanhoPagina} bytes · ${esc(cab.codificacao)}`],
    ["Tabelas", diag.tabelas.length ? esc(diag.tabelas.join(", ")) : "nenhuma legível"],
  ];
  partes.push("<dl>" + dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("") + "</dl>");
  if (perfil && perfil.aConfirmar) {
    partes.push("<p><strong>Atenção:</strong> as regras específicas deste banco ainda estão em validação; está sendo aplicado o procedimento padrão (cópia tabela a tabela).</p>");
  }
  if (cab.truncado) partes.push("<p><strong>Arquivo truncado:</strong> menor do que o banco declara; é provável que parte dos dados não exista mais no arquivo.</p>");
  if (cab.modoWal) partes.push("<p><strong>Modo WAL:</strong> se existir um arquivo <code>-wal</code> junto do banco, copie-o também.</p>");
  const msgs = diag.integridade.mensagens.filter((m) => m !== "ok");
  if (msgs.length || diag.integridade.erro) {
    const lista = msgs.slice(0, 5).map((m) => `<li>${esc(m.replace(/\n/g, " "))}</li>`);
    if (diag.integridade.erro) lista.push(`<li>${esc(diag.integridade.erro)}</li>`);
    partes.push(`<p>Mensagens do banco:</p><ul>${lista.join("")}</ul>`);
  }
  return partes.join("");
}

// ---- 3 e 4. recuperar + validar ----------------------------------------------------------------
async function recuperar() {
  bloquear(true);
  estado.bytes = null;
  estado.salvo = false;
  $("resultado-validar").hidden = true;
  $("passo-validar").disabled = true;
  $("passo-gerar").disabled = true;
  marcarTrilha("validar", "");
  marcarTrilha("gerar", "");
  barra("barra-recuperar", "indeterminada");
  $("barra-recuperar").hidden = false;
  let totalTabelas = 0;
  aoProgresso = (p) => {
    if (p.fase !== "recuperar") return;
    if (p.total) totalTabelas = p.total;
    if (p.indice !== undefined && p.total) barra("barra-recuperar", p.indice / p.total);
    if (p.tabela) {
      const pos = p.indice !== undefined ? ` (${p.indice + 1}/${totalTabelas})` : "";
      $("info-recuperar").textContent = `Tabela ${p.tabela}${pos}${p.linhas ? ` — ${milhar(p.linhas)} registros copiados` : ""}`;
    }
  };
  try {
    $("info-recuperar").textContent = "Criando o banco novo...";
    const rec = await comando("recuperar");
    estado.recuperacao = rec;
    barra("barra-recuperar", 1);
    $("info-recuperar").textContent = `Dados copiados em ${rec.segundos.toFixed(1).replace(".", ",")} s.`;
    marcarTrilha("recuperar", "feito");

    marcarTrilha("validar", "atual");
    $("passo-validar").disabled = false;
    $("info-validar").textContent = "Validando o banco novo...";
    aoProgresso = () => {};
    const val = await comando("validar", { relatorios: rec.relatorios });
    estado.validacao = val;
    mostrarCartao("resultado-validar", val.veredito === "integro" ? "ok" : val.veredito === "ressalvas" ? "ressalva" : "erro", htmlValidacao(val));
    $("info-validar").textContent = "";

    if (val.veredito === "falha") {
      registrar("erro", "O banco novo não passou na verificação de integridade. Não será gerado arquivo corrigido; envie o registro ao suporte.");
      marcarTrilha("validar", "erro");
      return;
    }
    registrar(val.veredito === "integro" ? "ok" : "aviso", val.veredito === "integro" ? "Validação concluída: banco íntegro." : "Validação concluída: banco íntegro, mas com tabelas recuperadas em modo parcial.");
    marcarTrilha("validar", "feito");
    marcarTrilha("gerar", "atual");
    $("passo-gerar").disabled = false;
    habilitar("btn-salvar", true);
    $("info-salvar").textContent = `O arquivo será salvo como ${nomeSaida()}.`;
  } catch (e) {
    registrar("erro", `Falha na recuperação: ${e.message}`);
    $("info-recuperar").textContent = `Erro: ${e.message}`;
    marcarTrilha(estado.recuperacao ? "validar" : "recuperar", "erro");
  } finally {
    aoProgresso = () => {};
    bloquear(false);
    reabilitar();
  }
}

function htmlValidacao(val) {
  const titulo = { integro: "Banco íntegro", ressalvas: "Recuperado com ressalvas", falha: "Falha na validação" }[val.veredito];
  const linhas = val.tabelas
    .map(
      (t) =>
        `<tr><td>${esc(t.nome)}</td><td class="num">${milhar(t.linhas)}</td><td>${t.metodo === "direto" ? "Cópia completa" : `<span class="parcial">Leitura parcial</span> — ${esc(t.detalhe)}`}</td></tr>`
    )
    .join("");
  const aviso =
    val.veredito === "ressalvas"
      ? "<p>O banco novo está íntegro, mas pelo menos uma tabela tinha área danificada e foi lida em modo parcial. Registros que estavam dentro do trecho ilegível não foram recuperados — confira as contagens com o que o cliente espera.</p>"
      : val.veredito === "falha"
      ? `<p>A verificação de integridade do banco novo não retornou <code>ok</code>:</p><ul>${val.mensagens.slice(0, 5).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`
      : "<p>Todas as tabelas foram copiadas por inteiro e a verificação de integridade do banco novo retornou <code>ok</code>.</p>";
  return `<h3>${titulo}</h3>${aviso}<div class="tabela-wrap"><table><thead><tr><th>Tabela</th><th class="num">Registros</th><th>Como foi copiada</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

// ---- 5. gerar banco corrigido -----------------------------------------------------------------------
function nomeSaida() {
  const base = estado.arquivo.name.replace(/\.[^.]+$/, "") || "banco";
  return `${base}_recuperado.db`;
}

async function salvar() {
  bloquear(true);
  try {
    if (!estado.bytes) {
      $("info-salvar").textContent = "Preparando o arquivo...";
      estado.bytes = await comando("exportar");
    }
    const nome = nomeSaida();
    let salvoComo;
    if (window.showSaveFilePicker) {
      try {
        const alvo = await window.showSaveFilePicker({
          suggestedName: nome,
          types: [{ description: "Banco SQLite", accept: { "application/vnd.sqlite3": [".db"] } }],
        });
        const w = await alvo.createWritable();
        await w.write(estado.bytes);
        await w.close();
        salvoComo = alvo.name;
      } catch (e) {
        if (e.name === "AbortError") {
          $("info-salvar").textContent = "Salvamento cancelado. Clique de novo quando quiser.";
          return;
        }
        throw e;
      }
    } else {
      const url = URL.createObjectURL(new Blob([estado.bytes], { type: "application/vnd.sqlite3" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      salvoComo = nome;
    }
    estado.salvo = true;
    registrar("ok", `Banco corrigido salvo como ${salvoComo} (${mb(estado.bytes.byteLength)}). O arquivo original não foi alterado.`);
    $("info-salvar").textContent = `Salvo como ${salvoComo}. O original não foi alterado.`;
    marcarTrilha("gerar", "feito");
  } catch (e) {
    registrar("erro", `Não foi possível salvar o arquivo: ${e.message}`);
    $("info-salvar").textContent = `Erro ao salvar: ${e.message}`;
    marcarTrilha("gerar", "erro");
  } finally {
    bloquear(false);
    reabilitar();
  }
}

/** Depois de uma operação, devolve o estado certo dos botões. */
function reabilitar() {
  habilitar("btn-arquivo", true);
  habilitar("btn-identificar", !!estado.arquivo);
  habilitar("btn-recuperar", !!estado.diagnostico && estado.diagnostico.paginaUm);
  habilitar("btn-salvar", !!estado.validacao && estado.validacao.veredito !== "falha");
}

// ---- compatibilidade e proteções --------------------------------------------------------------------------------
function verificarAmbiente() {
  const falta = [];
  if (typeof Worker === "undefined") falta.push("Web Workers");
  if (!navigator.storage || !navigator.storage.getDirectory) falta.push("armazenamento local (OPFS)");
  if (!falta.length) return true;
  const aviso = $("aviso-navegador");
  aviso.textContent = `Este navegador não tem recursos necessários (${falta.join(", ")}). Abra o FrontCore no Chrome ou no Edge atualizados.`;
  aviso.hidden = false;
  $("btn-arquivo").disabled = true;
  return false;
}

function travarAbaUnica() {
  if (!navigator.locks) return;
  navigator.locks.request("frontcore-recuperador-db", { ifAvailable: true }, (lock) => {
    if (lock) return new Promise(() => {}); // segura o bloqueio enquanto a aba existir
    $("aviso-aba").hidden = false;
    $("btn-arquivo").disabled = true;
    return undefined;
  });
}

window.addEventListener("beforeunload", (e) => {
  if (estado.ocupado || (estado.bytes && !estado.salvo)) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---- ligações ---------------------------------------------------------------------------------------------------------
$("btn-arquivo").addEventListener("click", () => $("entrada-arquivo").click());
$("entrada-arquivo").addEventListener("change", (e) => {
  const arquivo = e.target.files[0];
  e.target.value = "";
  aoEscolherArquivo(arquivo);
});
$("btn-identificar").addEventListener("click", identificar);
$("btn-recuperar").addEventListener("click", recuperar);
$("btn-salvar").addEventListener("click", salvar);

$("btn-copiar-log").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(textoRegistro());
    $("btn-copiar-log").textContent = "Copiado";
  } catch {
    $("btn-copiar-log").textContent = "Não foi possível copiar";
  }
  setTimeout(() => ($("btn-copiar-log").textContent = "Copiar"), 2000);
});
$("btn-baixar-log").addEventListener("click", () => {
  const base = estado.arquivo ? estado.arquivo.name.replace(/\.[^.]+$/, "") : "recuperador";
  const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  baixarTexto(`registro_${base}_${carimbo}.txt`, textoRegistro());
});
$("link-ajuda").addEventListener("click", () => {
  $("ajuda").open = true;
});

if (verificarAmbiente()) travarAbaUnica();
