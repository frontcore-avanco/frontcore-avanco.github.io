// -----------------------------------------------------------------------
// okr.js — página completa de OKR: resumo em números e todos os objetivos
// com seus resultados-chave. Os dados vêm da mesma fonte do painel da home
// (home/config-planilha.js); quando houver servidor, só a leitura muda.
// -----------------------------------------------------------------------
import { PLANILHA, RELER_A_CADA_MIN } from "../home/config-planilha.js";
import { lerAba } from "../home/planilha.js";
import { linhasOkr, agruparOkr, resumoObjetivo, htmlOkrCompleto, rodapeFonte } from "../home/render-dados.js";

function cartoes(linhas) {
  const resumos = agruparOkr(linhas).map(resumoObjetivo);
  const total = resumos.reduce((a, r) => a + r.total, 0);
  const com = resumos.reduce((a, r) => a + r.comAcompanhamento, 0);
  const progressos = resumos.map((r) => r.progresso).filter((p) => p !== null);
  const media = progressos.length ? `${Math.round((progressos.reduce((a, b) => a + b, 0) / progressos.length) * 100)}%` : "—";
  const c = (valor, texto) => `<div class="pd-cartao"><strong>${valor}</strong><span>${texto}</span></div>`;
  return c(resumos.length, "objetivos") + c(total, "resultados-chave") + c(`${com} de ${total}`, "com acompanhamento") + c(media, "progresso médio (onde há meta e atual)");
}

async function carregar() {
  const res = await lerAba("okr", PLANILHA.okr);
  const linhas = linhasOkr(res);
  document.getElementById("cartoes").innerHTML = cartoes(linhas);
  document.getElementById("okr").innerHTML = htmlOkrCompleto(linhas) + rodapeFonte(res, "Planilha ainda não conectada: exibindo os OKRs iniciais.");
}

carregar();
setInterval(carregar, RELER_A_CADA_MIN * 60 * 1000);
