// -----------------------------------------------------------------------
// app.js — Confere Diferença. Lê os dois arquivos (papel de cada um
// escolhido pelo usuário no <select>, já que o nome do arquivo muda a
// cada exportação) e cruza os dois — qualquer par de tipos diferentes entre
// Integral, Saída, Tramitado do novo Avanço e Tramitador —, mostrando só as
// diferenças.
// -----------------------------------------------------------------------
import { readXlsxRows } from "./xlsx-lite.js";
import { readCsvRows } from "./csv-lite.js";
import {
  parseIntegral,
  parseSaida,
  parseTramitador,
  compararIntegralTramitador,
  compararSaidaTramitador,
  compararNovoAvancoTramitador,
  compararIntegralSaida,
  alinharIntegral,
  detectarLayout,
} from "./comparador.js";
import { saveCsv } from "./save-csv.js";

// nome de cada tipo de arquivo nas telas e no CSV exportado
const ROTULO = { integral: "Integral", saida: "Saída", novoavanco: "Tramitado (novo Avanço)", tramitador: "Tramitador" };
// quando os dois são de tipos diferentes, o "lado da esquerda" da comparação
// é o primeiro desta lista (só muda a ordem das colunas na tabela)
const ORDEM = ["integral", "saida", "novoavanco", "tramitador"];
const NOME_TIPO = {
  integral: "do Integral",
  saida: "da Saída (novo Avanço)",
  tramitador: "do Tramitador",
  novoavanco: "do Tramitado (novo Avanço)",
};
// qual layout cada papel espera (o Tramitador e o Tramitado do novo Avanço
// usam o mesmo relatório "Notas Processadas")
const LAYOUT_DO_TIPO = { integral: "integral", saida: "saida", tramitador: "notas-processadas", novoavanco: "notas-processadas" };

const input1 = document.getElementById("arquivo1");
const input2 = document.getElementById("arquivo2");
const nome1 = document.getElementById("nome1");
const nome2 = document.getElementById("nome2");
const tipo1 = document.getElementById("tipo1");
const tipo2 = document.getElementById("tipo2");
const btnComparar = document.getElementById("btn-comparar");
const statusMsg = document.getElementById("status-msg");
const resultado = document.getElementById("resultado");
const resumo = document.getElementById("resumo");
const tabelaBody = document.querySelector("#tabela-diffs tbody");
const tabelaWrap = document.getElementById("tabela-wrap");
const btnExportar = document.getElementById("btn-exportar");

function atualizarNome(input, span) {
  span.textContent = input.files[0] ? input.files[0].name : "Nenhum arquivo selecionado";
}

input1.addEventListener("change", () => atualizarNome(input1, nome1));
input2.addEventListener("change", () => atualizarNome(input2, nome2));

function mostrarStatus(msg) {
  statusMsg.hidden = false;
  statusMsg.textContent = msg;
}

async function lerLinhas(file) {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    return readXlsxRows(file);
  }
  return readCsvRows(file);
}

let ultimosDiffs = [];
let ultimosRotulos = { a: "Integral", b: "Tramitador" };

btnComparar.addEventListener("click", async () => {
  resultado.hidden = true;

  if (!input1.files[0] || !input2.files[0]) {
    mostrarStatus("Selecione os dois arquivos antes de comparar.");
    return;
  }
  if (tipo1.value === tipo2.value) {
    mostrarStatus("Escolha dois tipos diferentes (por exemplo Integral e Tramitador, ou Integral e Tramitado do novo Avanço) — não dá pra comparar dois arquivos do mesmo tipo.");
    return;
  }

  // lado A = o que vem primeiro na ordem acima; lado B = o outro
  const lados = [
    { tipo: tipo1.value, arquivo: input1.files[0] },
    { tipo: tipo2.value, arquivo: input2.files[0] },
  ].sort((x, y) => ORDEM.indexOf(x.tipo) - ORDEM.indexOf(y.tipo));
  const [A, B] = lados;

  btnComparar.disabled = true;
  try {
    mostrarStatus("Lendo os arquivos... em planilhas grandes isso pode levar alguns segundos.");
    // cede o controle ao navegador antes do trabalho pesado, pra mensagem acima aparecer
    await new Promise((r) => setTimeout(r, 30));

    [A.linhas, B.linhas] = await Promise.all([lerLinhas(A.arquivo), lerLinhas(B.arquivo)]);

    // confere se cada arquivo tem o layout do papel escolhido (o nome muda a
    // cada exportação, então o jeito de saber é olhar o cabeçalho)
    for (const lado of lados) {
      const layout = detectarLayout(lado.linhas);
      if (layout && layout !== LAYOUT_DO_TIPO[lado.tipo]) {
        const sugestao =
          layout === "notas-processadas"
            ? 'o relatório "Notas Processadas" — marque-o como "do Tramitador" ou "do Tramitado (novo Avanço)"'
            : layout === "integral"
            ? 'o do Integral — marque-o como "do Integral"'
            : 'a Saída do novo Avanço — marque-a como "da Saída (novo Avanço)"';
        throw new Error(`O arquivo "${lado.arquivo.name}" está marcado como ${NOME_TIPO[lado.tipo]}, mas o conteúdo parece ser ${sugestao}.`);
      }
    }

    // lê cada lado pelo layout do seu tipo
    for (const lado of lados) {
      if (lado.tipo === "integral") lado.dados = parseIntegral(lado.linhas);
      else if (lado.tipo === "saida") lado.dados = parseSaida(lado.linhas);
      else lado.dados = parseTramitador(lado.linhas, lado.tipo === "novoavanco" ? "do novo Avanço" : "Tramitador");
    }

    const par = `${A.tipo}+${B.tipo}`;
    let diffs, totalA, totalB;
    if (A.tipo === "integral" && B.tipo === "saida") {
      diffs = compararIntegralSaida(A.dados, B.dados);
      totalA = A.dados.size;
      totalB = B.dados.size;
    } else if (A.tipo === "integral") {
      // Integral × (Tramitador | Tramitado do novo Avanço)
      const alinhado = alinharIntegral(A.dados, B.dados);
      diffs = compararIntegralTramitador(alinhado.integral, alinhado.tramitador, ROTULO[B.tipo]);
      totalA = A.dados.size;
      totalB = alinhado.tramitador.size;
    } else if (A.tipo === "saida") {
      // Saída × (Tramitador | Tramitado do novo Avanço), pela Chave de Acesso
      diffs = compararSaidaTramitador(A.dados, B.dados.porChave, ROTULO[B.tipo]);
      totalA = A.dados.size;
      totalB = B.dados.porChave.size;
    } else if (par === "novoavanco+tramitador") {
      diffs = compararNovoAvancoTramitador(A.dados.porChave, B.dados.porChave);
      totalA = A.dados.porChave.size;
      totalB = B.dados.porChave.size;
    } else {
      throw new Error("Combinação de tipos não suportada.");
    }
    ultimosDiffs = diffs;
    ultimosRotulos = { a: ROTULO[A.tipo], b: ROTULO[B.tipo] };

    renderResultado(diffs, totalA, totalB, ultimosRotulos);
    statusMsg.hidden = true;
  } catch (e) {
    mostrarStatus("Erro: " + e.message);
  } finally {
    btnComparar.disabled = false;
  }
});

function renderResultado(diffs, totalA, totalB, rotulos) {
  document.getElementById("th-valor-origem").textContent = `Valor ${rotulos.a}`;
  document.getElementById("th-valor-outro").textContent = `Valor ${rotulos.b}`;
  const contagem = `${rotulos.a}: ${totalA} · ${rotulos.b}: ${totalB}`;
  resumo.textContent = diffs.length
    ? `${contagem} · ${diffs.length} diferença(s) encontrada(s).`
    : `${contagem} · nenhuma diferença encontrada — está tudo batendo.`;

  tabelaBody.innerHTML = "";
  tabelaWrap.hidden = diffs.length === 0;
  btnExportar.hidden = diffs.length === 0;

  for (const d of diffs) {
    const tr = document.createElement("tr");
    const celulas = [
      d.nfce,
      d.tipo,
      d.detalhe,
      d.valorOrigem != null ? "R$ " + d.valorOrigem.toFixed(2) : "—",
      d.valorTramitador != null ? "R$ " + d.valorTramitador.toFixed(2) : "—",
      d.docum ?? "—",
      d.caixa ?? "—",
      d.data ?? "—",
    ];
    for (const texto of celulas) {
      const td = document.createElement("td");
      td.textContent = texto;
      tr.appendChild(td);
    }
    tabelaBody.appendChild(tr);
  }

  resultado.hidden = false;
}

function csvField(value) {
  const s = String(value ?? "");
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

btnExportar.addEventListener("click", async () => {
  const cabecalho = ["NFCe", "Tipo", "Detalhe", `Valor ${ultimosRotulos.a}`, `Valor ${ultimosRotulos.b}`, "Docum/Doc.PDV", "Caixa/Série", "Data"];
  const linhas = [cabecalho.map(csvField).join(";")];
  for (const d of ultimosDiffs) {
    linhas.push(
      [d.nfce, d.tipo, d.detalhe, d.valorOrigem ?? "", d.valorTramitador ?? "", d.docum ?? "", d.caixa ?? "", d.data ?? ""]
        .map(csvField)
        .join(";")
    );
  }
  const texto = "﻿" + linhas.join("\r\n") + "\r\n";
  await saveCsv(texto, "confere-diferenca.csv");
});
