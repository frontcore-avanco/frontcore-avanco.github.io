// -----------------------------------------------------------------------
// app.js — Renomeia Tudo. Liga a tela às regras (regras.js) e ao acesso
// à pasta (pasta.js): escolher pasta → escolher operação → prévia ao vivo
// → executar → resultado (com desfazer). Só o NOME dos arquivos muda.
// -----------------------------------------------------------------------
import { planejar, validarConfig } from "./regras.js";
import {
  suportaPastas,
  escolherPasta,
  listarEntradas,
  executarRenomeacoes,
  desfazerRenomeacoes,
} from "./pasta.js";

const LIMITE_LINHAS = 500;

const $ = (id) => document.getElementById(id);
const btnPasta = $("btn-pasta");
const btnRecarregar = $("btn-recarregar");
const infoPasta = $("info-pasta");
const avisoNavegador = $("aviso-navegador");
const passoRegra = $("passo-regra");
const passoPrevia = $("passo-previa");
const passoExecutar = $("passo-executar");
const resumoPrevia = $("resumo-previa");
const marcarSoMudancas = $("marcar-so-mudancas");
const soMudancas = $("so-mudancas");
const tabelaWrap = $("tabela-wrap");
const tabelaBody = document.querySelector("#tabela-previa tbody");
const notaLimite = $("nota-limite");
const btnExecutar = $("btn-executar");
const infoProgresso = $("info-progresso");
const blocoResultado = $("resultado");
const resultadoResumo = $("resultado-resumo");
const listaFalhas = $("lista-falhas");
const btnDesfazer = $("btn-desfazer");

let dir = null;
let entradas = [];
let plano = null;
let ultimaExecucao = null; // { feitos } da última execução, pra poder desfazer
let aposExecucao = false; // depois de executar, a prévia fica parada até a pessoa mexer em algo
let ocupado = false;

// ---- ajuda -------------------------------------------------------------
function abrirAjuda() {
  $("ajuda").open = true;
  $("ajuda").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("link-ajuda").addEventListener("click", (e) => {
  e.preventDefault();
  abrirAjuda();
});
if (location.hash === "#ajuda") $("ajuda").open = true;

// ---- configuração da regra --------------------------------------------
function operacaoAtual() {
  return document.querySelector('input[name="operacao"]:checked').value;
}

function lerConfig() {
  const operacao = operacaoAtual();
  if (operacao === "substituir") {
    return {
      operacao,
      alvo: $("alvo").value,
      procurar: $("procurar").value,
      trocarPor: $("trocar-por").value,
      diferenciarMaiusculas: $("maiusculas").checked,
      todasOcorrencias: $("todas").checked,
    };
  }
  const sufixo = operacao === "remover" ? "rem" : "ren";
  return {
    operacao,
    contarDe: $(`contar-de-${sufixo}`).value,
    posicao: parseInt($(`posicao-${sufixo}`).value, 10),
    quantidade: parseInt($(`quantidade-${sufixo}`).value, 10),
    novoTexto: operacao === "renomear" ? $("novo-texto").value : "",
  };
}

function mostrarPainel() {
  const operacao = operacaoAtual();
  for (const painel of document.querySelectorAll(".campos[data-op]")) {
    painel.hidden = painel.dataset.op !== operacao;
  }
  document.querySelector("[data-so-nome]").hidden = operacao === "substituir";
}

// ---- prévia ------------------------------------------------------------
function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

function textoSituacao(item) {
  switch (item.status) {
    case "ok": return ["Será renomeado", "sit-ok"];
    case "igual": return ["Sem alteração", "sit-igual"];
    case "conflito": return [`Conflito: ${item.mensagem}`, "sit-erro"];
    default: return [`Não permitido: ${item.mensagem}`, "sit-erro"];
  }
}

function limparPrevia(mensagem) {
  plano = null;
  resumoPrevia.textContent = mensagem;
  tabelaWrap.hidden = true;
  marcarSoMudancas.hidden = true;
  notaLimite.hidden = true;
  tabelaBody.replaceChildren();
  btnExecutar.textContent = "Renomear";
  btnExecutar.disabled = true;
}

function atualizarPrevia() {
  if (!dir) return;
  if (aposExecucao) {
    limparPrevia("Renomeação concluída. Altere qualquer opção acima para montar uma nova prévia.");
    return;
  }

  const config = lerConfig();
  const erro = validarConfig(config);
  if (erro) {
    limparPrevia(erro);
    return;
  }

  plano = planejar(entradas, config);
  const { ok, igual, conflito, invalido } = plano.contagem;
  const totalArquivos = plano.itens.length;

  if (totalArquivos === 0) {
    limparPrevia("A pasta não tem arquivos.");
    return;
  }

  const partes = [`${plural(ok, "arquivo será renomeado", "arquivos serão renomeados")}`];
  if (igual) partes.push(`${igual} sem alteração`);
  if (conflito) partes.push(plural(conflito, "em conflito", "em conflito"));
  if (invalido) partes.push(`${invalido} não permitido${invalido === 1 ? "" : "s"}`);
  resumoPrevia.textContent = partes.join(" · ");

  marcarSoMudancas.hidden = false;
  const visiveis = plano.itens.filter((i) => !soMudancas.checked || i.status !== "igual");
  tabelaBody.replaceChildren(
    ...visiveis.slice(0, LIMITE_LINHAS).map((item) => {
      const tr = document.createElement("tr");
      const [txt, classe] = textoSituacao(item);
      const celulas = [item.nome, item.status === "igual" ? "—" : item.novo];
      for (const t of celulas) {
        const td = document.createElement("td");
        td.textContent = t;
        tr.appendChild(td);
      }
      const tdSit = document.createElement("td");
      tdSit.className = `sit ${classe}`;
      tdSit.textContent = txt;
      tr.appendChild(tdSit);
      return tr;
    })
  );
  tabelaWrap.hidden = visiveis.length === 0;
  notaLimite.hidden = visiveis.length <= LIMITE_LINHAS;
  if (visiveis.length > LIMITE_LINHAS) {
    notaLimite.textContent = `Mostrando os primeiros ${LIMITE_LINHAS} de ${visiveis.length} arquivos — a regra vale para todos.`;
  }

  btnExecutar.textContent = ok ? `Renomear ${plural(ok, "arquivo", "arquivos")}` : "Renomear";
  btnExecutar.disabled = ok === 0 || ocupado;
}

async function carregarEntradas() {
  entradas = await listarEntradas(dir);
  const arquivos = entradas.filter((e) => e.tipo === "file").length;
  const pastas = entradas.length - arquivos;
  infoPasta.textContent =
    `${dir.name} — ${plural(arquivos, "arquivo", "arquivos")}` +
    (pastas ? ` (${plural(pastas, "subpasta ignorada", "subpastas ignoradas")})` : "");
}

async function aoMudarRegra() {
  if (!dir || ocupado) return;
  if (aposExecucao) {
    aposExecucao = false;
    await carregarEntradas();
  }
  atualizarPrevia();
}

// ---- escolher pasta ----------------------------------------------------
async function selecionarPasta() {
  let escolhida;
  try {
    escolhida = await escolherPasta();
  } catch (e) {
    if (e && e.name === "AbortError") return;
    infoPasta.textContent = "Não foi possível abrir a pasta: " + (e && e.message ? e.message : e);
    return;
  }
  dir = escolhida;
  aposExecucao = false;
  ultimaExecucao = null;
  blocoResultado.hidden = true;
  infoProgresso.textContent = "";
  await carregarEntradas();
  for (const passo of [passoRegra, passoPrevia, passoExecutar]) passo.disabled = false;
  btnRecarregar.hidden = false;
  atualizarPrevia();
}

btnPasta.addEventListener("click", selecionarPasta);
btnRecarregar.addEventListener("click", async () => {
  if (!dir || ocupado) return;
  aposExecucao = false;
  await carregarEntradas();
  atualizarPrevia();
});

// ---- executar / desfazer ----------------------------------------------
function mostrarResultado(resumo, falhas) {
  blocoResultado.hidden = false;
  resultadoResumo.textContent = resumo;
  listaFalhas.replaceChildren(
    ...falhas.slice(0, 50).map((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.de} → ${f.para}: ${f.erro}`;
      return li;
    })
  );
  if (falhas.length > 50) {
    const li = document.createElement("li");
    li.textContent = `...e mais ${falhas.length - 50} falha(s).`;
    listaFalhas.appendChild(li);
  }
  listaFalhas.hidden = falhas.length === 0;
}

function aoProgredir(feitos, total) {
  infoProgresso.textContent = `Processando ${feitos} de ${total}...`;
}

async function terminarOperacao() {
  ocupado = false;
  aposExecucao = true;
  btnPasta.disabled = false;
  await carregarEntradas();
  atualizarPrevia();
}

btnExecutar.addEventListener("click", async () => {
  if (!plano || ocupado) return;
  const itens = plano.itens.filter((i) => i.status === "ok");
  if (!itens.length) return;

  const confirmou = confirm(
    `Renomear ${plural(itens.length, "arquivo", "arquivos")} na pasta "${dir.name}"?\n\n` +
      "Só o nome muda, o conteúdo dos arquivos não é alterado. Depois você pode desfazer."
  );
  if (!confirmou) return;

  ocupado = true;
  btnExecutar.disabled = true;
  btnPasta.disabled = true;
  btnDesfazer.hidden = true;
  const { feitos, falhas } = await executarRenomeacoes(dir, itens, aoProgredir);
  ultimaExecucao = { feitos };
  infoProgresso.textContent = "";

  const resumo =
    `${plural(feitos.length, "arquivo renomeado", "arquivos renomeados")}` +
    (falhas.length ? ` · ${plural(falhas.length, "falha", "falhas")}` : "") +
    (falhas.length === 0 ? " — tudo certo." : ".");
  mostrarResultado(resumo, falhas);
  btnDesfazer.hidden = feitos.length === 0;
  await terminarOperacao();
});

btnDesfazer.addEventListener("click", async () => {
  if (!ultimaExecucao || ocupado) return;
  const { feitos } = ultimaExecucao;
  if (!confirm(`Desfazer a renomeação de ${plural(feitos.length, "arquivo", "arquivos")}?`)) return;

  ocupado = true;
  btnExecutar.disabled = true;
  btnPasta.disabled = true;
  const { revertidos, falhas } = await desfazerRenomeacoes(dir, feitos, aoProgredir);
  infoProgresso.textContent = "";
  ultimaExecucao = null;
  btnDesfazer.hidden = true;
  mostrarResultado(
    `${plural(revertidos.length, "arquivo voltou", "arquivos voltaram")} ao nome de antes` +
      (falhas.length ? ` · ${plural(falhas.length, "falha", "falhas")}.` : "."),
    falhas
  );
  await terminarOperacao();
});

// ---- eventos da regra --------------------------------------------------
for (const radio of document.querySelectorAll('input[name="operacao"]')) {
  radio.addEventListener("change", () => {
    mostrarPainel();
    aoMudarRegra();
  });
}
for (const campo of passoRegra.querySelectorAll("input:not([type=radio]), select")) {
  campo.addEventListener("input", aoMudarRegra);
  campo.addEventListener("change", aoMudarRegra);
}
soMudancas.addEventListener("change", atualizarPrevia);

// ---- início ------------------------------------------------------------
mostrarPainel();
if (!suportaPastas()) {
  avisoNavegador.hidden = false;
  btnPasta.disabled = true;
}
