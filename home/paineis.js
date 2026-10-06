// -----------------------------------------------------------------------
// paineis.js — preenche os painéis alimentados pela planilha (OKR, Ranking,
// Agenda, Novos manuais) e as notificações do sino. A home só entrega os
// painéis vazios (data-painel); aqui está o desenho de cada um.
// Tudo que vem da planilha é escapado antes de ir pra tela.
// -----------------------------------------------------------------------
import { PLANILHA, RELER_A_CADA_MIN } from "./config-planilha.js";
import { lerAba, pegar, dataDe, linkSeguro, normalizarChave, mesmoSite } from "./planilha.js";
import { esc, rodapeFonte, linhasOkr, htmlOkrResumo, periodoDoRanking, htmlRankingTop } from "./render-dados.js";

const hhmm = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const corpo = (id) => document.querySelector(`[data-painel="${id}"] .painel-corpo`);

/** Site de fora abre em aba nova; o próprio FrontCore abre na mesma aba pra
 * não perder o login (a sessão vale só dentro da aba). */
function abrirFora(link) {
  return /^https?:/i.test(link) && !mesmoSite(link) ? ' target="_blank" rel="noopener noreferrer"' : "";
}

// ---- OKR (só o resumo; o detalhe fica em okr/) ------------------------------------------
function desenharOkr(res) {
  corpo("okr").innerHTML =
    htmlOkrResumo(linhasOkr(res)) +
    `<p class="ver-mais"><a href="../okr/">Ver OKR completo →</a></p>` +
    rodapeFonte(res, "Planilha ainda não conectada: exibindo os OKRs iniciais.");
}

// ---- Ranking (top 3; a tabela completa fica em ranking/) ------------------------------------
function desenharRanking(res) {
  const periodo = periodoDoRanking(res.linhas);
  corpo("ranking").innerHTML =
    (periodo ? `<p class="rk-periodo">Período: ${esc(periodo)}</p>` : "") +
    (res.linhas.length || res.estado !== "nao-configurado" ? htmlRankingTop(res.linhas, 3) : `<p class="vazio-painel">O ranking será alimentado pela planilha.</p>`) +
    `<p class="ver-mais"><a href="../ranking/">Ver ranking completo →</a></p>` +
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
      const titulo = e.link ? `<a href="${esc(e.link)}"${abrirFora(e.link)}>${esc(e.titulo)}</a>` : esc(e.titulo);
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
  const titulo = n.link ? `<a href="${esc(n.link)}"${abrirFora(n.link)}>${esc(n.titulo)}</a>` : esc(n.titulo);
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
