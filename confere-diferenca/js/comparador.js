// -----------------------------------------------------------------------
// comparador.js — cruza a planilha de origem da loja (ERP Integral ou a
// Saída do novo Avanço) com o relatório do Tramitador, e acha os
// cupons/notas que não batem entre os dois.
//
// Origem (Integral ou Saída): cada linha é uma venda concluída no
// PDV/ERP da loja.
// Tramitador: lista tudo que foi processado na SEFAZ no período — inclui
// documentos de outro modelo (NF-e, não cupom), números inutilizados,
// rejeições e reprocessamentos do mesmo número de nota. Por isso, antes
// de comparar, a gente filtra só os documentos modelo 65 (cupom fiscal /
// NFC-e — o campo "modelo" vem embutido na Chave de Acesso, posições
// 21-22) e, quando o mesmo número de nota aparece mais de uma vez
// (reprocessamento), fica com a versão autorizada.
//
// Integral e Saída têm layouts (e nomes de arquivo) diferentes entre si,
// e cada um cruza com o Tramitador por uma chave diferente:
// - Integral não tem a Chave de Acesso, só o número puro da NFC-e e o
//   caixa (CX). Em lojas em que cada caixa tem a sua numeração, o mesmo
//   número existe em vários caixas, então cruza por caixa + número com
//   série + NNF do Tramitador (alinharIntegral). Se o caixa não bater com
//   a série, cai pro cruzamento só pelo número.
// - Saída tem a Chave de Acesso completa (Chave_Nota) — e o número da
//   nota sozinho SE REPETE entre caixas diferentes (cada um com sua
//   própria numeração), então só a chave completa é um identificador
//   confiável pra cruzar com o Tramitador.
// -----------------------------------------------------------------------

function normalizarValor(str) {
  if (str == null || str === "") return null;
  if (typeof str === "number") return str;
  const t = String(str).trim();
  // "1.234,56" (formato brasileiro) → ponto é milhar; "7.98" (só ponto, 1 ou 2
  // casas) → ponto é decimal; "1.234" (3 casas) → milhar.
  const soPontoDecimal = !t.includes(",") && /^-?\d+\.\d{1,2}$/.test(t);
  const limpo = soPontoDecimal ? t : t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isNaN(n) ? null : n;
}

function normalizarChave(valor) {
  if (valor == null) return "";
  return String(valor).trim().replace(/^0+(?=\d)/, "");
}

function acharColuna(headerRow, ...nomes) {
  const alvos = nomes.map((n) => n.toLowerCase());
  for (let i = 0; i < headerRow.length; i++) {
    const cell = (headerRow[i] ?? "").toString().trim().toLowerCase();
    if (alvos.includes(cell)) return i;
  }
  return -1;
}

function acharLinhaCabecalho(rows, coluna0Esperada) {
  const alvo = coluna0Esperada.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const primeira = (rows[i][0] ?? "").toString().trim().toLowerCase();
    if (primeira === alvo) return i;
  }
  return -1;
}

/** Extrai as vendas do arquivo do ERP Integral, indexadas por NFC-e. */
export function parseIntegral(rows) {
  const headerIdx = acharLinhaCabecalho(rows, "lj");
  if (headerIdx === -1) {
    throw new Error(
      'Não encontrei o cabeçalho do Integral (esperava a coluna "Lj" na primeira posição). Confirma se esse é mesmo o arquivo do ERP Integral?'
    );
  }
  const header = rows[headerIdx];

  const colNfce = acharColuna(header, "NFCe");
  const colValor = acharColuna(header, "Valor");
  const colDocum = acharColuna(header, "Docum");
  const colLj = acharColuna(header, "Lj");
  const colCx = acharColuna(header, "CX");
  const colData = acharColuna(header, "Data");
  const colHora = acharColuna(header, "Hora");
  const colTipo = acharColuna(header, "Tipo");
  const colOperador = acharColuna(header, "Operador");

  if (colNfce === -1) {
    throw new Error('Não encontrei a coluna "NFCe" no arquivo do Integral.');
  }

  const porNfce = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[colNfce]) continue;
    const nfce = normalizarChave(row[colNfce]);
    if (!nfce) continue;
    // Em algumas lojas cada caixa tem a sua própria numeração (o mesmo
    // número de NFC-e existe em vários caixas), então a chave é caixa + número.
    const cxNorm = colCx >= 0 ? normalizarChave(row[colCx]) : "";
    porNfce.set(`${cxNorm}|${nfce}`, {
      nfce,
      docum: colDocum >= 0 ? row[colDocum] : null,
      lj: colLj >= 0 ? row[colLj] : null,
      cx: colCx >= 0 ? row[colCx] : null,
      data: colData >= 0 ? row[colData] : null,
      hora: colHora >= 0 ? row[colHora] : null,
      valor: normalizarValor(colValor >= 0 ? row[colValor] : null),
      tipo: colTipo >= 0 ? row[colTipo] : null,
      operador: colOperador >= 0 ? row[colOperador] : null,
    });
  }
  return porNfce;
}

/** Converte um serial de data do Excel (dias desde 30/12/1899) pro mesmo
 * formato "DD/MM/AAAA HH:MM:SS" usado nos outros arquivos. A planilha de
 * Saída grava a data como número formatado (não como texto), diferente
 * do Integral/Tramitador. */
function converterDataExcel(serial) {
  if (typeof serial !== "number" || Number.isNaN(serial)) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** Extrai as vendas da planilha de Saída do novo Avanço, indexadas pela
 * Chave de Acesso completa (o número da nota sozinho se repete entre
 * caixas diferentes, então não serve como chave única aqui). */
export function parseSaida(rows) {
  const headerIdx = acharLinhaCabecalho(rows, "numero_nota");
  if (headerIdx === -1) {
    throw new Error(
      'Não encontrei o cabeçalho da Saída (esperava a coluna "Numero_Nota" na primeira posição). Confirma se esse é mesmo o relatório de Saída do novo Avanço?'
    );
  }
  const header = rows[headerIdx];

  const colNumero = acharColuna(header, "Numero_Nota");
  const colSerie = acharColuna(header, "Serie", "Série");
  const colData = acharColuna(header, "Data_Emissao", "Data_Emissão");
  const colChave = acharColuna(header, "Chave_Nota", "Chave Nota", "Chave_Acesso", "Chave Acesso");
  const colValor = acharColuna(header, "Preco_Total", "Preço_Total", "Preco Total", "Preço Total");
  const colStatus = acharColuna(header, "Status");

  if (colChave === -1) {
    throw new Error('Não encontrei a coluna "Chave_Nota" no arquivo de Saída — preciso dela pra cruzar com o Tramitador.');
  }

  const porChave = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[colChave] == null || row[colChave] === "") continue;

    const chave = String(row[colChave]).trim();
    const modelo = chave.length >= 22 ? chave.slice(20, 22) : "";
    if (modelo === "55") continue; // NF-e normal (não é cupom) — fora da comparação

    const dataBruta = colData >= 0 ? row[colData] : null;
    porChave.set(chave, {
      chave,
      numeroNota: colNumero >= 0 ? row[colNumero] : null,
      serie: colSerie >= 0 ? row[colSerie] : null,
      data: typeof dataBruta === "number" ? converterDataExcel(dataBruta) : dataBruta,
      valor: normalizarValor(colValor >= 0 ? row[colValor] : null),
      status: colStatus >= 0 ? row[colStatus] : null,
    });
  }
  return porChave;
}

const SITUACOES_VALIDAS = new Set(["AUTORIZADA", "AUTORIZADA FORA DO PRAZO"]);

/** Extrai os documentos modelo 65 (cupom fiscal / NFC-e) do relatório do
 * Tramitador e devolve dois índices sobre os mesmos documentos:
 * - `porNnf`: por número da nota (NNF) — já resolvendo reprocessamentos
 *   (mesma nota, chave nova a cada tentativa; fica com a versão
 *   autorizada). Usado pra comparar com o Integral.
 * - `porChave`: pela Chave de Acesso completa, sem nenhuma resolução de
 *   duplicidade (a chave já é única por natureza — embute NNF, série e
 *   um código aleatório por tentativa). Usado pra comparar com a Saída,
 *   já que ali o número da nota sozinho se repete entre caixas
 *   diferentes — indexar só por NNF (como o `porNnf` faz) derrubaria
 *   silenciosamente um documento real sempre que dois caixas emitissem
 *   o mesmo número. */
export function parseTramitador(rows, rotulo = "Tramitador") {
  const headerIdx = acharLinhaCabecalho(rows, "nnf");
  if (headerIdx === -1) {
    throw new Error(
      `Não encontrei o cabeçalho do relatório ${rotulo} (esperava a coluna "NNF" na primeira posição, depois das linhas de título). Confirma se esse é mesmo o relatório "Notas Processadas"?`
    );
  }
  const header = rows[headerIdx];

  const colNnf = acharColuna(header, "NNF");
  const colDocPdv = acharColuna(header, "Doc. PDV", "Doc PDV");
  const colSerie = acharColuna(header, "Série", "Serie");
  const colSituacaoCod = acharColuna(header, "Situação", "Situacao");
  const colSituacaoTexto = colSituacaoCod >= 0 ? colSituacaoCod + 1 : -1;
  const colValorTotal = acharColuna(header, "Valor Total");
  const colChave = acharColuna(header, "Chave Acesso", "Chave de Acesso");
  const colDataEmissao = acharColuna(header, "Data Emissão", "Data Emissao");

  if (colNnf === -1) {
    throw new Error(`Não encontrei a coluna "NNF" no arquivo ${rotulo}.`);
  }
  if (colChave === -1) {
    throw new Error(
      `Não encontrei a coluna "Chave Acesso" no arquivo ${rotulo} — preciso dela pra saber se o documento é NF-e ou NFC-e.`
    );
  }

  const porNnf = new Map();
  const porSerieNnf = new Map();
  const porChave = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[colNnf] == null || row[colNnf] === "") continue;

    const chave = String(row[colChave] ?? "");
    const modelo = chave.length >= 22 ? chave.slice(20, 22) : "";
    if (modelo === "55") continue; // NF-e normal (não é cupom) — fora da comparação

    const nnf = normalizarChave(row[colNnf]);
    if (!nnf) continue;
    const situacao = colSituacaoTexto >= 0 ? String(row[colSituacaoTexto] ?? "").trim().toUpperCase() : "";

    const doc = {
      nnf,
      docPdv: colDocPdv >= 0 ? row[colDocPdv] : null,
      serie: colSerie >= 0 ? row[colSerie] : null,
      situacao,
      valor: normalizarValor(colValorTotal >= 0 ? row[colValorTotal] : null),
      chave,
      dataEmissao: colDataEmissao >= 0 ? row[colDataEmissao] : null,
    };

    const existente = porNnf.get(nnf);
    if (!existente || (!SITUACOES_VALIDAS.has(existente.situacao) && SITUACOES_VALIDAS.has(situacao))) {
      porNnf.set(nnf, doc);
    }
    // mesma resolução de reprocessamento, mas dentro de cada série (caixa)
    const chaveSerie = `${normalizarChave(doc.serie)}|${nnf}`;
    const existenteSerie = porSerieNnf.get(chaveSerie);
    if (!existenteSerie || (!SITUACOES_VALIDAS.has(existenteSerie.situacao) && SITUACOES_VALIDAS.has(situacao))) {
      porSerieNnf.set(chaveSerie, doc);
    }
    if (chave) porChave.set(chave, doc);
  }
  return { porNnf, porSerieNnf, porChave };
}

/** Decide como cruzar o Integral com o Tramitador. Se o caixa do Integral
 * bate com a série do Tramitador (o normal), cruza por caixa + número —
 * necessário nas lojas em que o mesmo número de NFC-e existe em vários
 * caixas. Se o caixa não corresponde à série, cai pro cruzamento só pelo
 * número (comportamento anterior). Devolve os dois índices já na mesma chave. */
export function alinharIntegral(integral, tramitador) {
  let casaSerie = 0;
  let casaNnf = 0;
  for (const [chave, venda] of integral) {
    if (tramitador.porSerieNnf.has(chave)) casaSerie++;
    if (tramitador.porNnf.has(venda.nfce)) casaNnf++;
  }
  if (casaSerie >= casaNnf) {
    return { modo: "serie", integral, tramitador: tramitador.porSerieNnf };
  }
  const porNfce = new Map();
  for (const venda of integral.values()) porNfce.set(venda.nfce, venda);
  return { modo: "nnf", integral: porNfce, tramitador: tramitador.porNnf };
}

const TOLERANCIA_VALOR = 0.01;

/** Cruza os dois mapas (por número da NFC-e) e devolve só as diferenças
 * — cupons/notas que não batem entre o Integral e o Tramitador. */
export function compararIntegralTramitador(integral, tramitador, rotuloOutro = "Tramitador") {
  const diffs = [];
  const vistos = new Set();

  for (const [chave, venda] of integral) {
    const nfce = venda.nfce;
    vistos.add(chave);
    const doc = tramitador.get(chave);

    if (!doc) {
      diffs.push({
        nfce,
        tipo: `Não encontrado no ${rotuloOutro}`,
        detalhe: `Tem venda no Integral, mas essa NFC-e não aparece no relatório do ${rotuloOutro}.`,
        valorOrigem: venda.valor,
        valorTramitador: null,
        situacaoTramitador: null,
        docum: venda.docum,
        caixa: venda.cx,
        data: venda.data,
        hora: venda.hora,
      });
      continue;
    }

    if (!SITUACOES_VALIDAS.has(doc.situacao)) {
      diffs.push({
        nfce,
        tipo: `Situação no ${rotuloOutro}: ${doc.situacao || "desconhecida"}`,
        detalhe: `O Integral registra essa venda como concluída, mas no ${rotuloOutro} ela está como "${doc.situacao}".`,
        valorOrigem: venda.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: venda.docum,
        caixa: doc.serie ?? venda.cx,
        data: venda.data,
        hora: venda.hora,
      });
      continue;
    }

    if (venda.valor != null && doc.valor != null && Math.abs(venda.valor - doc.valor) > TOLERANCIA_VALOR) {
      diffs.push({
        nfce,
        tipo: "Valor diferente",
        detalhe: `Integral: R$ ${venda.valor.toFixed(2)} · ${rotuloOutro}: R$ ${doc.valor.toFixed(2)}`,
        valorOrigem: venda.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: venda.docum,
        caixa: doc.serie ?? venda.cx,
        data: venda.data,
        hora: venda.hora,
      });
    }
  }

  // Notas autorizadas no Tramitador sem nenhum registro no Integral.
  // (Cancelada/rejeitada/inutilizada sem venda no Integral é esperado —
  // não é sinalizado como diferença.)
  for (const [chave, doc] of tramitador) {
    if (vistos.has(chave)) continue;
    if (!SITUACOES_VALIDAS.has(doc.situacao)) continue;
    diffs.push({
      nfce: doc.nnf,
      tipo: "Não encontrado no Integral",
      detalhe: `Está autorizada no ${rotuloOutro}, mas essa NFC-e não aparece no Integral.`,
      valorOrigem: null,
      valorTramitador: doc.valor,
      situacaoTramitador: doc.situacao,
      docum: doc.docPdv,
      caixa: doc.serie,
      data: doc.dataEmissao,
      hora: null,
    });
  }

  diffs.sort((a, b) => Number(a.nfce) - Number(b.nfce));
  return diffs;
}

/** Cruza a Saída do novo Avanço com o Tramitador pela Chave de Acesso
 * completa (ver comentário no topo do arquivo — o número da nota sozinho
 * não é confiável aqui) e devolve só as diferenças. Recebe o índice
 * `porChave` já pronto de `parseTramitador` (não o `porNnf`). */
export function compararSaidaTramitador(saida, tramitadorPorChave, rotuloOutro = "Tramitador") {
  const diffs = [];
  const vistos = new Set();

  for (const [chave, venda] of saida) {
    vistos.add(chave);
    const doc = tramitadorPorChave.get(chave);

    if (!doc) {
      diffs.push({
        nfce: venda.numeroNota,
        tipo: `Não encontrado no ${rotuloOutro}`,
        detalhe: `Tem saída registrada no novo Avanço, mas essa nota não aparece no relatório do ${rotuloOutro}.`,
        valorOrigem: venda.valor,
        valorTramitador: null,
        situacaoTramitador: null,
        docum: venda.numeroNota,
        caixa: venda.serie,
        data: venda.data,
        hora: null,
      });
      continue;
    }

    if (!SITUACOES_VALIDAS.has(doc.situacao)) {
      diffs.push({
        nfce: venda.numeroNota,
        tipo: `Situação no ${rotuloOutro}: ${doc.situacao || "desconhecida"}`,
        detalhe: `A Saída registra esse documento como concluído, mas no ${rotuloOutro} ele está como "${doc.situacao}".`,
        valorOrigem: venda.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: doc.docPdv ?? venda.numeroNota,
        caixa: doc.serie ?? venda.serie,
        data: venda.data,
        hora: null,
      });
      continue;
    }

    if (venda.valor != null && doc.valor != null && Math.abs(venda.valor - doc.valor) > TOLERANCIA_VALOR) {
      diffs.push({
        nfce: venda.numeroNota,
        tipo: "Valor diferente",
        detalhe: `Saída: R$ ${venda.valor.toFixed(2)} · ${rotuloOutro}: R$ ${doc.valor.toFixed(2)}`,
        valorOrigem: venda.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: doc.docPdv ?? venda.numeroNota,
        caixa: doc.serie ?? venda.serie,
        data: venda.data,
        hora: null,
      });
    }
  }

  // Notas autorizadas no Tramitador sem nenhum registro na Saída.
  for (const [chave, doc] of tramitadorPorChave) {
    if (vistos.has(chave)) continue;
    if (!SITUACOES_VALIDAS.has(doc.situacao)) continue;
    diffs.push({
      nfce: doc.nnf,
      tipo: "Não encontrado na Saída",
      detalhe: `Está autorizada no ${rotuloOutro}, mas esse documento não aparece na planilha de Saída.`,
      valorOrigem: null,
      valorTramitador: doc.valor,
      situacaoTramitador: doc.situacao,
      docum: doc.docPdv,
      caixa: doc.serie,
      data: doc.dataEmissao,
      hora: null,
    });
  }

  diffs.sort((a, b) => Number(a.nfce) - Number(b.nfce));
  return diffs;
}

/** Identifica o layout de uma planilha pela linha de cabeçalho (o relatório
 * "Notas Processadas" tem algumas linhas de título antes do cabeçalho).
 * Devolve "integral", "saida", "notas-processadas" ou null. */
export function detectarLayout(rows) {
  const limite = Math.min(rows.length, 30);
  for (let i = 0; i < limite; i++) {
    const primeira = (rows[i]?.[0] ?? "").toString().trim().toLowerCase();
    if (primeira === "nnf") return "notas-processadas";
    if (primeira === "lj") return "integral";
    if (primeira === "numero_nota") return "saida";
  }
  return null;
}

/** Cruza o relatório "Notas Processadas" gerado no portal do novo Avanço
 * (mesmo layout do Tramitador) com o do Tramitador, pela Chave de Acesso.
 * Os dois lados têm situação e valor, então a comparação é nos dois
 * sentidos. Recebe os dois índices `porChave` de `parseTramitador`. */
export function compararNovoAvancoTramitador(novoAvanco, tramitadorPorChave) {
  const diffs = [];
  const vistos = new Set();

  for (const [chave, nova] of novoAvanco) {
    vistos.add(chave);
    const doc = tramitadorPorChave.get(chave);

    if (!doc) {
      diffs.push({
        nfce: nova.nnf,
        tipo: "Não encontrado no Tramitador",
        detalhe: `Está no novo Avanço (${nova.situacao || "sem situação"}), mas não aparece no relatório do Tramitador.`,
        valorOrigem: nova.valor,
        valorTramitador: null,
        situacaoTramitador: null,
        docum: nova.docPdv,
        caixa: nova.serie,
        data: nova.dataEmissao,
        hora: null,
      });
      continue;
    }

    if (nova.situacao !== doc.situacao) {
      diffs.push({
        nfce: nova.nnf,
        tipo: "Situação diferente",
        detalhe: `novo Avanço: ${nova.situacao || "—"} · Tramitador: ${doc.situacao || "—"}`,
        valorOrigem: nova.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: doc.docPdv ?? nova.docPdv,
        caixa: doc.serie ?? nova.serie,
        data: nova.dataEmissao,
        hora: null,
      });
      continue;
    }

    if (SITUACOES_VALIDAS.has(nova.situacao) && nova.valor != null && doc.valor != null && Math.abs(nova.valor - doc.valor) > TOLERANCIA_VALOR) {
      diffs.push({
        nfce: nova.nnf,
        tipo: "Valor diferente",
        detalhe: `novo Avanço: R$ ${nova.valor.toFixed(2)} · Tramitador: R$ ${doc.valor.toFixed(2)}`,
        valorOrigem: nova.valor,
        valorTramitador: doc.valor,
        situacaoTramitador: doc.situacao,
        docum: doc.docPdv ?? nova.docPdv,
        caixa: doc.serie ?? nova.serie,
        data: nova.dataEmissao,
        hora: null,
      });
    }
  }

  for (const [chave, doc] of tramitadorPorChave) {
    if (vistos.has(chave)) continue;
    diffs.push({
      nfce: doc.nnf,
      tipo: "Não encontrado no novo Avanço",
      detalhe: `Está no Tramitador (${doc.situacao || "sem situação"}), mas não aparece no relatório do novo Avanço.`,
      valorOrigem: null,
      valorTramitador: doc.valor,
      situacaoTramitador: doc.situacao,
      docum: doc.docPdv,
      caixa: doc.serie,
      data: doc.dataEmissao,
      hora: null,
    });
  }

  diffs.sort((a, b) => Number(a.nfce) - Number(b.nfce));
  return diffs;
}

/** Cruza o Integral com a Saída do novo Avanço, sem o Tramitador no meio.
 * O Integral não tem chave de acesso, então o cruzamento é por caixa +
 * número (série + número da nota na Saída); se o caixa não bater com a
 * série, cai pro cruzamento só pelo número. `integral` vem de
 * `parseIntegral` (chave caixa|número) e `saida` de `parseSaida`. */
export function compararIntegralSaida(integral, saida) {
  const saidaSerie = new Map();
  const saidaNum = new Map();
  for (const s of saida.values()) {
    const num = normalizarChave(s.numeroNota);
    saidaSerie.set(`${normalizarChave(s.serie)}|${num}`, s);
    saidaNum.set(num, s);
  }

  let casaSerie = 0;
  let casaNum = 0;
  for (const [chave, venda] of integral) {
    if (saidaSerie.has(chave)) casaSerie++;
    if (saidaNum.has(venda.nfce)) casaNum++;
  }
  const usarSerie = casaSerie >= casaNum;
  const achar = (chave, venda) => (usarSerie ? saidaSerie.get(chave) : saidaNum.get(venda.nfce));

  const diffs = [];
  const vistos = new Set();
  for (const [chave, venda] of integral) {
    const s = achar(chave, venda);
    if (!s) {
      diffs.push({
        nfce: venda.nfce,
        tipo: "Não encontrado na Saída",
        detalhe: "Tem venda no Integral, mas essa nota não aparece na planilha de Saída.",
        valorOrigem: venda.valor,
        valorTramitador: null,
        situacaoTramitador: null,
        docum: venda.docum,
        caixa: venda.cx,
        data: venda.data,
        hora: venda.hora,
      });
      continue;
    }
    vistos.add(s);
    if (venda.valor != null && s.valor != null && Math.abs(venda.valor - s.valor) > TOLERANCIA_VALOR) {
      diffs.push({
        nfce: venda.nfce,
        tipo: "Valor diferente",
        detalhe: `Integral: R$ ${venda.valor.toFixed(2)} · Saída: R$ ${s.valor.toFixed(2)}`,
        valorOrigem: venda.valor,
        valorTramitador: s.valor,
        situacaoTramitador: s.status,
        docum: venda.docum,
        caixa: s.serie ?? venda.cx,
        data: venda.data,
        hora: venda.hora,
      });
    }
  }

  for (const s of saida.values()) {
    if (vistos.has(s)) continue;
    diffs.push({
      nfce: s.numeroNota,
      tipo: "Não encontrado no Integral",
      detalhe: `Está na Saída (${s.status || "sem status"}), mas essa nota não aparece no Integral.`,
      valorOrigem: null,
      valorTramitador: s.valor,
      situacaoTramitador: s.status,
      docum: s.numeroNota,
      caixa: s.serie,
      data: s.data,
      hora: null,
    });
  }

  diffs.sort((a, b) => Number(a.nfce) - Number(b.nfce));
  return diffs;
}
