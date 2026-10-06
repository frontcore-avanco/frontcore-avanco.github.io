// -----------------------------------------------------------------------
// ranking.js — página completa do ranking: destaques (top 3 de cada
// indicador) e tabela com todos os operadores, ordenável. Mesma fonte de
// dados do painel da home (home/config-planilha.js).
// -----------------------------------------------------------------------
import { PLANILHA, RELER_A_CADA_MIN } from "../home/config-planilha.js";
import { lerAba } from "../home/planilha.js";
import { esc, fmtNum, rodapeFonte, htmlRankingTop, operadoresDoRanking, periodoDoRanking } from "../home/render-dados.js";

let operadores = [];
let ordem = { campo: "atend", sentido: "descending" };

function desenharTabela() {
  const { campo, sentido } = ordem;
  const fator = sentido === "ascending" ? 1 : -1;
  // sem número vai sempre pro fim, qualquer que seja o sentido
  const lista = [...operadores].sort((a, b) => {
    if (campo === "nome") return fator * a.nome.localeCompare(b.nome, "pt-BR");
    if (a[campo] === null && b[campo] === null) return 0;
    if (a[campo] === null) return 1;
    if (b[campo] === null) return -1;
    return fator * (a[campo] - b[campo]);
  });
  const num = (n, suf = "") => (n === null ? "—" : `${fmtNum(n)}${suf}`);
  document.querySelector("#tabela tbody").innerHTML = lista.length
    ? lista.map((o) => `<tr><td>${esc(o.nome)}</td><td class="num">${num(o.atend)}</td><td class="num">${num(o.satisf, " ★")}</td><td class="num">${num(o.bug)}</td></tr>`).join("")
    : `<tr><td colspan="4">Sem dados ainda.</td></tr>`;
  for (const th of document.querySelectorAll("#tabela th")) th.setAttribute("aria-sort", th.dataset.campo === campo ? sentido : "none");
}

document.querySelector("#tabela thead").addEventListener("click", (e) => {
  const th = e.target.closest("th");
  if (!th) return;
  const campo = th.dataset.campo;
  // primeiro clique: números do maior pro menor, nome de A a Z
  const inicial = campo === "nome" ? "ascending" : "descending";
  ordem = { campo, sentido: ordem.campo === campo ? (ordem.sentido === "ascending" ? "descending" : "ascending") : inicial };
  desenharTabela();
});

async function carregar() {
  const res = await lerAba("ranking", PLANILHA.ranking);
  operadores = operadoresDoRanking(res.linhas);
  const periodo = periodoDoRanking(res.linhas);
  document.getElementById("periodo").textContent = periodo ? `Período: ${periodo}` : "Indicadores individuais do suporte";
  const vazio = res.estado === "nao-configurado" ? "O ranking será alimentado pela planilha." : "Nenhum operador na planilha ainda.";
  document.getElementById("top").innerHTML = operadores.length ? htmlRankingTop(res.linhas, 3) : `<p class="vazio-painel">${vazio}</p>`;
  document.getElementById("fonte").innerHTML = rodapeFonte(res, "Planilha ainda não conectada.");
  desenharTabela();
}

carregar();
setInterval(carregar, RELER_A_CADA_MIN * 60 * 1000);
