// -----------------------------------------------------------------------
// planilha.js — lê uma aba publicada (CSV) e entrega linhas como objetos.
// Sem dependência de tela: só texto entra, objetos saem. Tudo que vem da
// planilha deve ser tratado como texto não confiável (escapar ao exibir).
// -----------------------------------------------------------------------

/** CSV → matriz de células (aspas, vírgulas e quebras de linha dentro de célula). */
export function lerCsv(texto) {
  const linhas = [];
  let linha = [];
  let celula = "";
  let aspas = false;
  const s = String(texto || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"' && s[i + 1] === '"') { celula += '"'; i++; }
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(celula); celula = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      linha.push(celula);
      celula = "";
      linhas.push(linha);
      linha = [];
    } else celula += c;
  }
  if (celula !== "" || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

export function normalizarChave(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** CSV → [{cabecalho_normalizado: valor}], ignorando linhas totalmente vazias. */
export function csvParaObjetos(texto) {
  const matriz = lerCsv(texto);
  if (!matriz.length) return [];
  const chaves = matriz[0].map(normalizarChave);
  return matriz
    .slice(1)
    .filter((l) => l.some((c) => String(c).trim() !== ""))
    .map((l) => Object.fromEntries(chaves.map((k, i) => [k, String(l[i] ?? "").trim()])));
}

/** Valor da primeira coluna cujo nome começa com um dos prefixos. */
export function pegar(linha, ...prefixos) {
  for (const p of prefixos) {
    const k = Object.keys(linha).find((c) => c === p || c.startsWith(p));
    if (k) return linha[k];
  }
  return "";
}

/** "4,5", "80%", "1.234,5", "12" → número; texto qualquer → null. */
export function numero(txt) {
  let t = String(txt ?? "").trim().replace(/%$/, "").replace(/\s/g, "");
  if (t === "" || !/^-?[\d.,]+$/.test(t)) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "05/10/2026" ou "2026-10-05" → Date (meio-dia local) ou null. */
export function dataDe(txt) {
  const t = String(txt ?? "").trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return validarData(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validarData(+m[1], +m[2], +m[3]);
  return null;
}

function validarData(a, mes, d) {
  const dt = new Date(a, mes - 1, d, 12);
  return dt.getFullYear() === a && dt.getMonth() === mes - 1 && dt.getDate() === d ? dt : null;
}

/** O link aponta pro próprio FrontCore? (a sessão de login é por aba: abrir
 * o próprio site em aba nova perderia o login.) */
export function mesmoSite(url) {
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

/** Só deixa passar links http(s) ou caminhos do próprio site. */
export function linkSeguro(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(\.{1,2}\/|\/)?[\w\-./#?=&%]+$/.test(u) && !/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return "";
}

// ---- leitura da planilha, com cópia guardada pra quando a internet falhar ----
const PREFIXO_CACHE = "frontcore_planilha_";

/** @returns {Promise<{estado:"ok"|"cache"|"erro"|"nao-configurado", linhas:object[], lidoEm?:number}>} */
export async function lerAba(nome, url) {
  if (!url) return { estado: "nao-configurado", linhas: [] };
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const texto = await resp.text();
    if (/^\s*<(!doctype|html)/i.test(texto)) throw new Error("a planilha não está publicada como CSV");
    try {
      localStorage.setItem(PREFIXO_CACHE + nome, JSON.stringify({ texto, ts: Date.now() }));
    } catch {
      /* sem cache */
    }
    return { estado: "ok", linhas: csvParaObjetos(texto), lidoEm: Date.now() };
  } catch (e) {
    try {
      const salvo = JSON.parse(localStorage.getItem(PREFIXO_CACHE + nome));
      if (salvo && salvo.texto) return { estado: "cache", linhas: csvParaObjetos(salvo.texto), lidoEm: salvo.ts, erro: e.message };
    } catch {
      /* sem cache */
    }
    return { estado: "erro", linhas: [], erro: e.message };
  }
}
