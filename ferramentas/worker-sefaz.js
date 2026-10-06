// -----------------------------------------------------------------------
// worker-sefaz.js — mini-serviço (Cloudflare Workers, plano gratuito) que
// consulta o status da SEFAZ MG na hora e devolve pro botão "Consultar
// agora" da tela inicial do FrontCore. Existe porque o navegador não pode
// consultar o monitor da Zorte direto (ele não libera acesso a outros sites).
//
// Devolve o mesmo formato do arquivo que o robô do GitHub publica
// (ferramentas/status-sefaz.mjs), então a tela usa os dois do mesmo jeito.
//
// Como colocar no ar (uma vez, sem instalar nada):
//   1. Crie uma conta grátis em https://dash.cloudflare.com
//   2. Workers & Pages → Create → Create Worker → nome: frontcore-sefaz → Deploy
//   3. Edit code → apague o exemplo, cole TODO este arquivo → Deploy
//   4. Copie o endereço (https://frontcore-sefaz.<seu-nome>.workers.dev)
//      e coloque em home/config-sefaz.js (PROXY_SEFAZ).
//
// Cada consulta à Zorte fica guardada por 60 s no Cloudflare: se muita
// gente clicar junto, a Zorte é consultada no máximo uma vez por minuto.
// Fonte não oficial: se a Zorte mudar ou sair do ar, o estado vira
// "indisponivel" (nunca verde por engano).
// -----------------------------------------------------------------------
const UF = "MG";
const API = "https://monitor.zorte.com.br/api/status/";
const DOCS = { nfce: "NFC-e", nfe: "NF-e" };
const ORIGENS_PERMITIDAS = ["https://frontcore-avanco.github.io", "http://localhost:8752", "http://127.0.0.1:8752"];

const ROTULOS = {
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
  if (max - min < 0.08) return null;
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  return (h * 60 + 360) % 360;
}

// mesma regra do robô (ferramentas/status-sefaz.mjs): a decisão vem da cor do quadro
function classificar(item) {
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
  try {
    const resp = await fetch(API + doc, {
      headers: { "User-Agent": "FrontCore-status/1.0 (+https://frontcore-avanco.github.io)" },
      signal: AbortSignal.timeout(10000),
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const item = (await resp.json())?.[UF];
    if (!item || typeof item !== "object") throw new Error(`a resposta não trouxe ${UF}`);
    const estado = classificar(item);
    return {
      nome: DOCS[doc],
      estado,
      rotulo: ROTULOS[estado],
      contingencia: semAcento(item.svc) === "sim",
      tempoResposta: typeof item.tempo_resposta === "number" ? item.tempo_resposta : null,
      erro: null,
    };
  } catch (e) {
    return { nome: DOCS[doc], estado: "indisponivel", rotulo: ROTULOS.indisponivel, contingencia: false, tempoResposta: null, erro: e.message || String(e) };
  }
}

export default {
  async fetch(request) {
    const origem = request.headers.get("Origin") || "";
    const cabecalhos = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=20",
      Vary: "Origin",
    };
    if (ORIGENS_PERMITIDAS.includes(origem)) cabecalhos["Access-Control-Allow-Origin"] = origem;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cabecalhos, "Access-Control-Allow-Methods": "GET" } });
    if (request.method !== "GET") return new Response(JSON.stringify({ erro: "método não permitido" }), { status: 405, headers: cabecalhos });

    const [nfce, nfe] = await Promise.all([consultar("nfce"), consultar("nfe")]);
    const corpo = {
      uf: UF,
      atualizadoEm: new Date().toISOString(),
      fonte: { nome: "Zorte Monitor", url: "https://monitor.zorte.com.br" },
      docs: { nfce, nfe },
    };
    return new Response(JSON.stringify(corpo), { headers: cabecalhos });
  },
};
