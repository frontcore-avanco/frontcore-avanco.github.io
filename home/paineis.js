// -----------------------------------------------------------------------
// paineis.js — preenche os painéis alimentados pela planilha (OKR, Ranking,
// Agenda, Novos manuais) e as notificações do sino. A home só entrega os
// painéis vazios (data-painel); aqui está o desenho de cada um.
// Tudo que vem da planilha é escapado antes de ir pra tela.
// -----------------------------------------------------------------------
import { PLANILHA, RELER_A_CADA_MIN } from "./config-planilha.js";
import { lerAba, pegar, numero, dataDe, linkSeguro, normalizarChave } from "./planilha.js";
import { OKR_INICIAL } from "./okr-inicial.js";

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtNum = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const hhmm = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const corpo = (id) => document.querySelector(`[data-painel="${id}"] .painel-corpo`);

function rodapeFonte(res, textoVazio) {
  if (res.estado === "ok") return `<p class="fonte">Planilha lida às ${hhmm(res.lidoEm)}.</p>`;
  if (res.estado === "cache") return `<p class="fonte fonte-alerta">Sem acesso à planilha agora; mostrando a última leitura (${new Date(res.lidoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}).</p>`;
  if (res.estado === "erro") return `<p class="fonte fonte-alerta">Não foi possível ler a planilha (${esc(res.erro)}).</p>`;
  return `<p class="fonte">${textoVazio}</p>`;
}

// ---- OKR ---------------------------------------------------------------------------
function faixaProgresso(r) {
  if (r >= 1) return "verde";
  if (r >= 0.7) return "amarelo";
  return "laranja";
}

function htmlKr(l) {
  const texto = pegar(l, "resultado");
  const meta = pegar(l, "meta");
  const atual = pegar(l, "atual");
  const un = pegar(l, "unidade");
  const nMeta = numero(meta);
  const nAtual = numero(atual);
  const sufixo = un && un !== "%" ? ` ${esc(un)}` : un === "%" ? "%" : "";
  const notas = [pegar(l, "observ"), pegar(l, "prazo") && `Prazo: ${pegar(l, "prazo")}`].filter(Boolean).map(esc).join(" · ");

  let valor;
  let barra = "";
  if (nMeta !== null && nAtual !== null && nMeta > 0) {
    const r = nAtual / nMeta;
    valor = `${fmtNum(nAtual)}${sufixo} <span>de ${fmtNum(nMeta)}${sufixo}</span>`;
    barra = `<div class="kr-barra" role="progressbar" aria-valuenow="${Math.round(Math.min(r, 1) * 100)}" aria-valuemin="0" aria-valuemax="100"><span class="tom-${faixaProgresso(r)}" style="width:${Math.round(Math.min(r, 1) * 100)}%"></span></div>`;
  } else {
    const partes = [];
    if (meta) partes.push(`Meta: ${esc(meta)}${nMeta !== null ? sufixo : un ? ` ${esc(un)}` : ""}`);
    partes.push(atual ? `Atual: ${esc(atual)}${nAtual !== null ? sufixo : ""}` : "Sem acompanhamento lançado");
    valor = `<span>${partes.join(" · ")}</span>`;
  }
  return `<li class="kr"><p class="kr-texto">${esc(texto)}</p><p class="kr-valor">${valor}</p>${barra}${notas ? `<p class="kr-nota">${notas}</p>` : ""}</li>`;
}

function desenharOkr(res) {
  const usarInicial = res.estado === "nao-configurado" || res.estado === "erro";
  const linhas = usarInicial ? OKR_INICIAL : res.linhas;
  const grupos = new Map();
  for (const l of linhas) {
    const obj = pegar(l, "objetivo");
    if (!pegar(l, "resultado")) continue;
    if (!grupos.has(obj)) grupos.set(obj, []);
    grupos.get(obj).push(l);
  }
  const html = grupos.size
    ? [...grupos].map(([obj, krs], i) => `<section class="okr-obj"><h3><span class="okr-num">${i + 1}</span>${esc(obj || "Sem objetivo")}</h3><ul class="krs">${krs.map(htmlKr).join("")}</ul></section>`).join("")
    : `<p class="vazio-painel">Nenhum OKR na planilha ainda.</p>`;
  corpo("okr").innerHTML = html + rodapeFonte(res, "Planilha ainda não conectada: exibindo os OKRs iniciais.");
}

// ---- Ranking ---------------------------------------------------------------------------------
const INDICADORES = [
  { campo: ["atend"], titulo: "Maior quantidade de atendimentos", emoji: "🥇", formato: (n) => fmtNum(n) },
  { campo: ["satisf"], titulo: "Melhor índice de satisfação", emoji: "⭐", formato: (n) => `${fmtNum(n)} ★` },
  { campo: ["bug"], titulo: "Mais cards de bugs e melhorias", emoji: "🐞", formato: (n) => fmtNum(n) },
];
const MEDALHAS = ["🥇", "🥈", "🥉"];

function desenharRanking(res) {
  const periodo = res.linhas.map((l) => pegar(l, "periodo")).find(Boolean);
  const blocos = INDICADORES.map((ind) => {
    const lista = res.linhas
      .map((l) => ({ nome: pegar(l, "operador", "nome"), valor: numero(pegar(l, ...ind.campo)) }))
      .filter((x) => x.nome && x.valor !== null)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3);
    const itens = lista.length
      ? lista.map((x, i) => `<li><span class="rk-pos">${MEDALHAS[i]}</span><span class="rk-nome">${esc(x.nome)}</span><span class="rk-valor">${ind.formato(x.valor)}</span></li>`).join("")
      : `<li class="rk-vazio">Sem dados</li>`;
    return `<section class="rk-bloco"><h3><span>${ind.emoji}</span>${ind.titulo}</h3><ol class="rk-lista">${itens}</ol></section>`;
  }).join("");
  corpo("ranking").innerHTML =
    (periodo ? `<p class="rk-periodo">Período: ${esc(periodo)}</p>` : "") +
    (res.linhas.length || res.estado !== "nao-configurado" ? blocos : `<p class="vazio-painel">O ranking será alimentado pela planilha.</p>`) +
    rodapeFonte(res, "Planilha ainda não conectada.");
}

// ---- Agenda -----------------------------------------------------------------------------------------
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function desenharAgenda(res) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const eventos = res.linhas
    .map((l) => ({ data: dataDe(pegar(l, "data")), hora: pegar(l, "hora"), titulo: pegar(l, "titulo", "evento"), tipo: pegar(l, "tipo"), link: linkSeguro(pegar(l, "link")) }))
    .filter((e) => e.data && e.titulo && e.data >= hoje)
    .sort((a, b) => a.data - b.data || a.hora.localeCompare(b.hora))
    .slice(0, 6);
  const itens = eventos
    .map((e) => {
      const ehHoje = e.data.toDateString() === hoje.toDateString();
      const titulo = e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">${esc(e.titulo)}</a>` : esc(e.titulo);
      const sub = [ehHoje ? "Hoje" : "", e.hora, e.tipo].filter(Boolean).map(esc).join(" · ");
      return `<li><span class="ag-data${ehHoje ? " hoje" : ""}"><strong>${String(e.data.getDate()).padStart(2, "0")}</strong>${MESES[e.data.getMonth()]}</span><span class="ag-corpo"><strong>${titulo}</strong>${sub ? `<span>${sub}</span>` : ""}</span></li>`;
    })
    .join("");
  const vazio = res.estado === "nao-configurado" ? "A agenda será alimentada pela planilha." : "Nenhum compromisso futuro na agenda.";
  corpo("agenda").innerHTML = (itens ? `<ul class="ag-lista">${itens}</ul>` : `<p class="vazio-painel">${vazio}</p>`) + rodapeFonte(res, "Planilha ainda não conectada.");
}

// ---- Notificações (sino + painel de manuais) ------------------------------------------------------------
function categoria(tipo) {
  const t = normalizarChave(tipo);
  if (t.includes("manual")) return t.includes("atualiz") ? { id: "manual-atualizado", rotulo: "Manual atualizado" } : { id: "manual-novo", rotulo: "Manual novo" };
  if (t.includes("ferramenta") || t.includes("funcao")) return { id: "ferramenta", rotulo: "Ferramenta" };
  if (t.includes("base") || t.includes("conhecimento")) return { id: "base", rotulo: "Base de Conhecimento" };
  return { id: "outro", rotulo: tipo || "Aviso" };
}

const CHAVE_LIDAS = "frontcore_notif_lidas";
const DIAS_COMO_NOVA = 14;
let notificacoes = [];

function lerLidas() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_LIDAS)) || []);
  } catch {
    return new Set();
  }
}

function prepararNotificacoes(linhas) {
  return linhas
    .map((l) => {
      const data = dataDe(pegar(l, "data"));
      const titulo = pegar(l, "titulo");
      return { chave: `${pegar(l, "data")}|${titulo}`, data, titulo, cat: categoria(pegar(l, "tipo")), link: linkSeguro(pegar(l, "link")) };
    })
    .filter((n) => n.titulo)
    .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0));
}

function itemNotificacao(n) {
  const dt = n.data ? n.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  const externo = /^https?:/i.test(n.link);
  const titulo = n.link ? `<a href="${esc(n.link)}"${externo ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(n.titulo)}</a>` : esc(n.titulo);
  return `<li><span class="nt-tag nt-${n.cat.id}">${esc(n.cat.rotulo)}</span><span class="nt-titulo">${titulo}</span><span class="nt-data">${dt}</span></li>`;
}

function ehNova(n, lidas) {
  if (lidas.has(n.chave)) return false;
  if (!n.data) return true;
  return Date.now() - n.data.getTime() <= DIAS_COMO_NOVA * 86400000;
}

function desenharNotificacoes(res) {
  notificacoes = prepararNotificacoes(res.linhas);

  const manuais = notificacoes.filter((n) => n.cat.id.startsWith("manual")).slice(0, 6);
  const vazio = res.estado === "nao-configurado" ? "Os manuais novos aparecerão aqui, alimentados pela planilha." : "Nenhum manual novo ou atualizado por enquanto.";
  corpo("novos-manuais").innerHTML = (manuais.length ? `<ul class="nt-lista">${manuais.map(itemNotificacao).join("")}</ul>` : `<p class="vazio-painel">${vazio}</p>`) + rodapeFonte(res, "Planilha ainda não conectada.");

  const pop = document.getElementById("pop-sino");
  const recentes = notificacoes.slice(0, 10);
  pop.innerHTML = recentes.length
    ? `<p class="pop-titulo">Notificações</p><ul class="nt-lista">${recentes.map(itemNotificacao).join("")}</ul>`
    : "Sem notificações no momento.";
  pop.classList.toggle("pop-notificacoes", recentes.length > 0);
  atualizarSelo();
}

function atualizarSelo() {
  const botao = document.getElementById("btn-sino");
  let selo = botao.querySelector(".selo-sino");
  const novas = notificacoes.filter((n) => ehNova(n, lerLidas())).length;
  if (!novas) return selo?.remove();
  if (!selo) {
    selo = document.createElement("span");
    selo.className = "selo-sino";
    botao.append(selo);
  }
  selo.textContent = novas > 9 ? "9+" : String(novas);
  botao.setAttribute("aria-label", `Notificações (${novas} novas)`);
}

function marcarComoLidas() {
  const lidas = lerLidas();
  for (const n of notificacoes) lidas.add(n.chave);
  try {
    localStorage.setItem(CHAVE_LIDAS, JSON.stringify([...lidas].slice(-200)));
  } catch {
    /* sem armazenamento: o selo só volta na próxima visita */
  }
  document.getElementById("btn-sino").setAttribute("aria-label", "Notificações");
}

// ---- ciclo --------------------------------------------------------------------------------------------------------
async function atualizar() {
  const [okr, ranking, agenda, notif] = await Promise.all([
    lerAba("okr", PLANILHA.okr),
    lerAba("ranking", PLANILHA.ranking),
    lerAba("agenda", PLANILHA.agenda),
    lerAba("notificacoes", PLANILHA.notificacoes),
  ]);
  desenharOkr(okr);
  desenharRanking(ranking);
  desenharAgenda(agenda);
  desenharNotificacoes(notif);
}

export function iniciarPaineis() {
  // o sino: ao abrir, as notificações passam a contar como lidas
  document.getElementById("btn-sino").addEventListener("click", () => {
    setTimeout(() => {
      if (!document.getElementById("pop-sino").hidden) {
        marcarComoLidas();
        document.getElementById("btn-sino").querySelector(".selo-sino")?.remove();
      }
    }, 0);
  });
  atualizar();
  setInterval(atualizar, RELER_A_CADA_MIN * 60 * 1000);
}
