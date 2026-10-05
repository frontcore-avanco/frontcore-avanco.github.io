// -----------------------------------------------------------------------
// status-sefaz.mjs — consulta o status da SEFAZ de MG (NFC-e e NF-e) no
// monitor público da Zorte e grava um JSON pequeno com o resultado.
// Roda no GitHub Actions a cada 10 minutos (.github/workflows/status-sefaz.yml);
// a tela inicial do FrontCore lê esse JSON.
//
// Fonte: https://monitor.zorte.com.br — a API que a própria página deles
// usa (sem login). Não é documentada nem oficial: se mudar ou sair do ar,
// o JSON sai com estado "indisponivel" (nunca verde por engano).
//
// Uso: node ferramentas/status-sefaz.mjs [arquivo-de-saida.json]
// -----------------------------------------------------------------------
import fs from "node:fs";

const UF = "MG";
const API = "https://monitor.zorte.com.br/api/status/";
const DOCS = { nfce: "NFC-e", nfe: "NF-e" };
const TENTATIVAS = 3;

export const ROTULOS = {
  normal: "Normal",
  instavel: "Instável",
  lentidao: "Lentidão",
  parada: "Parada",
  contingencia: "Contingência ativa",
  desconhecido: "Não identificado",
  indisponivel: "Indisponível",
};

function semAcento(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function matiz(rgb) {
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(String(rgb ?? ""));
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((n) => Number(n) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.08) return null; // cinza: sem cor definida
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  return (h * 60 + 360) % 360;
}

/** Traduz o item de MG da API pro nosso vocabulário. A legenda da Zorte
 * (Normal / Instável / Lentidão / Parada / Contingência ativa) é só a cor
 * do quadro, então a decisão vem da cor (matiz) e do campo `svc`. */
export function classificar(item) {
  if (semAcento(item.svc) === "sim") return "contingencia";
  const h = matiz(item.bg);
  if (h === null) return item.normal === 1 ? "normal" : "desconhecido";
  if (h >= 70 && h < 170) return "normal";
  if (h >= 40 && h < 70) return "instavel";
  if (h >= 15 && h < 40) return "lentidao";
  if (h < 15 || h >= 340) return "parada";
  if (h >= 190 && h < 270) return "contingencia";
  return "desconhecido";
}

async function consultar(doc) {
  let ultimoErro = "falha desconhecida";
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resp = await fetch(API + doc, {
        headers: { "User-Agent": "FrontCore-status/1.0 (+https://frontcore-avanco.github.io)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const dados = await resp.json();
      const item = dados?.[UF];
      if (!item || typeof item !== "object") throw new Error(`a resposta não trouxe ${UF}`);
      const estado = classificar(item);
      return {
        estado,
        rotulo: ROTULOS[estado],
        contingencia: semAcento(item.svc) === "sim",
        tempoResposta: typeof item.tempo_resposta === "number" ? item.tempo_resposta : null,
        erro: null,
      };
    } catch (e) {
      ultimoErro = e.message || String(e);
      if (tentativa < TENTATIVAS) await new Promise((r) => setTimeout(r, 2000 * tentativa));
    }
  }
  return { estado: "indisponivel", rotulo: ROTULOS.indisponivel, contingencia: false, tempoResposta: null, erro: ultimoErro };
}

async function principal() {
  const saida = process.argv[2] || "sefaz-mg.json";
  const docs = {};
  for (const doc of Object.keys(DOCS)) docs[doc] = { nome: DOCS[doc], ...(await consultar(doc)) };

  const resultado = {
    uf: UF,
    atualizadoEm: new Date().toISOString(),
    fonte: { nome: "Zorte Monitor", url: "https://monitor.zorte.com.br" },
    docs,
  };
  fs.writeFileSync(saida, JSON.stringify(resultado, null, 2) + "\n", "utf-8");
  for (const [doc, d] of Object.entries(docs)) console.log(`${DOCS[doc]}: ${d.rotulo}${d.erro ? ` (${d.erro})` : ""}`);
}

// roda só quando chamado direto (não ao ser importado pelos testes)
if (process.argv[1]?.endsWith("status-sefaz.mjs")) {
  await principal();
}
