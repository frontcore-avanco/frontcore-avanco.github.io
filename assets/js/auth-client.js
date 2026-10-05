// -----------------------------------------------------------------------
// auth-client.js — login da equipe SEM servidor (site estático no GitHub
// Pages). As contas ficam em assets/js/usuarios.js, só com o hash da
// senha (PBKDF2); o navegador calcula o hash do que a pessoa digitou e
// compara.
//
// Isso barra o acesso casual, mas não é segurança de verdade: o arquivo
// de usuários é público (repositório público), então alguém técnico pode
// tentar descobrir uma senha por força bruta offline. Por isso as senhas
// são geradas aleatórias (ferramentas/gerar-usuario.mjs), nunca escolhidas
// à mão. Quando existir servidor próprio, a versão com backend real
// está na branch `login-servidor` deste repositório.
// -----------------------------------------------------------------------
import { USUARIOS } from "./usuarios.js";

const encoder = new TextEncoder();

function hexParaBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesParaHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function derivarHash(senha, saltHex, iteracoes) {
  const chave = await crypto.subtle.importKey("raw", encoder.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexParaBytes(saltHex), iterations: iteracoes },
    chave,
    256
  );
  return bytesParaHex(new Uint8Array(bits));
}

/** Confere e-mail + senha contra a lista de usuários. Devolve
 * { token, nome } ou lança erro com a mensagem pra mostrar na tela. */
export async function login(email, senha) {
  const alvo = String(email || "").trim().toLowerCase();
  const usuario = USUARIOS.find((u) => u.email.toLowerCase() === alvo);

  // Mesmo quando o e-mail não existe, faz uma derivação "de mentirinha"
  // pra a resposta demorar igual — assim não dá pra descobrir quais
  // e-mails existem só pelo tempo de resposta.
  const referencia = usuario || { salt: "00".repeat(16), hash: "", iteracoes: USUARIOS[0]?.iteracoes ?? 210000 };
  const hashTentativa = await derivarHash(senha, referencia.salt, referencia.iteracoes);

  if (!usuario || hashTentativa !== usuario.hash) {
    throw new Error("E-mail ou senha incorretos.");
  }
  return { token: crypto.randomUUID(), nome: usuario.nome };
}
