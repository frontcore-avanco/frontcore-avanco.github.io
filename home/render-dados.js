// -----------------------------------------------------------------------
// render-dados.js — o desenho dos dados de OKR e Ranking, usado pelos
// painéis da home (resumo) e pelas páginas próprias (okr/, ranking/).
// Recebe linhas já lidas da planilha e devolve HTML; tudo que vem da
// planilha é escapado aqui. A origem dos dados (planilha hoje, servidor
// depois) fica em planilha.js / config-planilha.js.
// -----------------------------------------------------------------------
import { pegar, numero } from "./planilha.js";
import { OKR_INICIAL } from "./okr-inicial.js";

export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const fmtNum = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const hhmm = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Linha de rodapé dizendo de onde vieram os dados. */
export function rodapeFonte(res, textoVazio) {
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

/** Progresso (0..1+) de um resultado-chave, ou null se não tem meta e atual numéricos. */
function progressoKr(l) {
  const nMeta = numero(pegar(l, "meta"));
  const nAtual = numero(pegar(l, "atual"));
  return nMeta !== null && nAtual !== null && nMeta > 0 ? nAtual / nMeta : null;
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
  const r = progressoKr(l);
  if (r !== null) {
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

/** Linhas de OKR a usar: as da planilha, ou os OKRs iniciais quando a
 * planilha não está conectada / não pôde ser lida. */
export function linhasOkr(res) {
  return res.estado === "nao-configurado" || res.estado === "erro" ? OKR_INICIAL : res.linhas;
}

/** [{ objetivo, krs: [linha...] }] na ordem em que aparecem na planilha. */
export function agruparOkr(linhas) {
  const grupos = new Map();
  for (const l of linhas) {
    if (!pegar(l, "resultado")) continue;
    const obj = pegar(l, "objetivo");
    if (!grupos.has(obj)) grupos.set(obj, []);
    grupos.get(obj).push(l);
  }
  return [...grupos].map(([objetivo, krs]) => ({ objetivo: objetivo || "Sem objetivo", krs }));
}

/** Números de um objetivo: quantos resultados-chave, quantos já têm
 * acompanhamento lançado e o progresso médio dos que têm meta e atual numéricos. */
export function resumoObjetivo(grupo) {
  const progressos = grupo.krs.map(progressoKr).filter((r) => r !== null);
  return {
    objetivo: grupo.objetivo,
    total: grupo.krs.length,
    comAcompanhamento: grupo.krs.filter((l) => pegar(l, "atual") !== "").length,
    progresso: progressos.length ? progressos.reduce((a, b) => a + Math.min(b, 1), 0) / progressos.length : null,
  };
}

/** Página completa: todos os objetivos com seus resultados-chave. */
export function htmlOkrCompleto(linhas) {
  const grupos = agruparOkr(linhas);
  if (!grupos.length) return `<p class="vazio-painel">Nenhum OKR na planilha ainda.</p>`;
  return grupos
    .map((g, i) => `<section class="okr-obj"><h3><span class="okr-num">${i + 1}</span>${esc(g.objetivo)}</h3><ul class="krs">${g.krs.map(htmlKr).join("")}</ul></section>`)
    .join("");
}

/** Painel da home: uma linha por objetivo, com o progresso quando há. */
export function htmlOkrResumo(linhas) {
  const grupos = agruparOkr(linhas);
  if (!grupos.length) return `<p class="vazio-painel">Nenhum OKR na planilha ainda.</p>`;
  const itens = grupos
    .map((g, i) => {
      const r = resumoObjetivo(g);
      const sub = `${r.total} resultado${r.total === 1 ? "" : "s"}-chave · ${r.comAcompanhamento} com acompanhamento`;
      const pct = r.progresso === null ? null : Math.round(r.progresso * 100);
      const barra =
        pct === null
          ? ""
          : `<div class="kr-barra" role="progressbar" aria-valuenow="${Math.min(pct, 100)}" aria-valuemin="0" aria-valuemax="100"><span class="tom-${faixaProgresso(r.progresso)}" style="width:${Math.min(pct, 100)}%"></span></div>`;
      return (
        `<li class="rs-obj"><span class="okr-num">${i + 1}</span><div class="rs-corpo">` +
        `<div class="rs-linha"><strong>${esc(r.objetivo)}</strong>${pct === null ? "" : `<span class="rs-pct">${pct}%</span>`}</div>` +
        `${barra}<span class="rs-sub">${sub}</span></div></li>`
      );
    })
    .join("");
  return `<ul class="rs-lista">${itens}</ul>`;
}

// ---- Ranking ---------------------------------------------------------------------------------
export const INDICADORES = [
  { id: "atend", campo: ["atend"], titulo: "Maior quantidade de atendimentos", curto: "Atendimentos", emoji: "🥇", formato: (n) => fmtNum(n) },
  { id: "satisf", campo: ["satisf"], titulo: "Melhor índice de satisfação", curto: "Satisfação", emoji: "⭐", formato: (n) => `${fmtNum(n)} ★` },
  { id: "bug", campo: ["bug"], titulo: "Mais cards de bugs e melhorias", curto: "Bugs e melhorias", emoji: "🐞", formato: (n) => fmtNum(n) },
];
const MEDALHAS = ["🥇", "🥈", "🥉"];

export function periodoDoRanking(linhas) {
  return linhas.map((l) => pegar(l, "periodo")).find(Boolean) || "";
}

/** Operadores com seus três números (null onde faltar). */
export function operadoresDoRanking(linhas) {
  return linhas
    .map((l) => ({
      nome: pegar(l, "operador", "nome"),
      atend: numero(pegar(l, "atend")),
      satisf: numero(pegar(l, "satisf")),
      bug: numero(pegar(l, "bug")),
    }))
    .filter((o) => o.nome);
}

/** Blocos "top N" de cada indicador. */
export function htmlRankingTop(linhas, n = 3) {
  const ops = operadoresDoRanking(linhas);
  return INDICADORES.map((ind) => {
    const lista = ops
      .filter((o) => o[ind.id] !== null)
      .sort((a, b) => b[ind.id] - a[ind.id])
      .slice(0, n);
    const itens = lista.length
      ? lista.map((o, i) => `<li><span class="rk-pos">${MEDALHAS[i] ?? i + 1}</span><span class="rk-nome">${esc(o.nome)}</span><span class="rk-valor">${ind.formato(o[ind.id])}</span></li>`).join("")
      : `<li class="rk-vazio">Sem dados</li>`;
    return `<section class="rk-bloco"><h3><span>${ind.emoji}</span>${ind.titulo}</h3><ol class="rk-lista">${itens}</ol></section>`;
  }).join("");
}
