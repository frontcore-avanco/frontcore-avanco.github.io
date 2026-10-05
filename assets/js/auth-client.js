// -----------------------------------------------------------------------
// auth-client.js — login da equipe SEM servidor (site estático no GitHub
// Pages). As contas ficam em assets/js/usuarios.js, só com o hash da
// senha inicial (PBKDF2); o navegador calcula o hash do que a pessoa
// digitou e compara.
//
// Troca de senha: no primeiro acesso a pessoa define uma senha nova, que
// fica guardada só no navegador dela (localStorage). Sem servidor não há
// onde gravar isso pra todos os aparelhos — em outro navegador/computador
// (ou depois de limpar os dados do navegador) vale de novo a senha
// inicial e a troca é pedida outra vez.
//
// Isso barra o acesso casual, mas não é segurança de verdade: o arquivo
// de usuários é público (repositório público), então a senha inicial é o
// elo fraco. Quando existir servidor próprio, a versão com backend real
// está na branch `login-servidor` deste repositório.
// -----------------------------------------------------------------------
import { USUARIOS } from "./usuarios.js";

const encoder = new TextEncoder();
const CHAVE_SENHAS_LOCAIS = "frontcore_senhas";
const ITERACOES = 210000;

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

function lerSenhasLocais() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SENHAS_LOCAIS)) || {};
  } catch {
    return {};
  }
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Confere e-mail + senha. Devolve { token, nome, precisaTrocarSenha } ou
 * lança erro com a mensagem pra mostrar na tela. */
export async function login(email, senha) {
  const alvo = normalizarEmail(email);
  const usuario = USUARIOS.find((u) => u.email.toLowerCase() === alvo);
  const senhaLocal = usuario ? lerSenhasLocais()[alvo] : null;

  // Se esse navegador já trocou a senha, vale a nova; senão, a inicial.
  // Mesmo quando o e-mail não existe, faz uma derivação "de mentirinha"
  // pra a resposta demorar igual — assim não dá pra descobrir quais
  // e-mails existem só pelo tempo de resposta.
  const referencia = senhaLocal || usuario || { salt: "00".repeat(16), hash: "", iteracoes: ITERACOES };
  const hashTentativa = await derivarHash(senha, referencia.salt, referencia.iteracoes);

  if (!usuario || hashTentativa !== referencia.hash) {
    throw new Error("E-mail ou senha incorretos.");
  }
  return {
    token: crypto.randomUUID(),
    nome: usuario.nome,
    precisaTrocarSenha: !senhaLocal && usuario.trocarSenha === true,
  };
}

/** Define a senha nova desse e-mail, válida só neste navegador. */
export async function trocarSenha(email, novaSenha) {
  const alvo = normalizarEmail(email);
  const salt = bytesParaHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derivarHash(novaSenha, salt, ITERACOES);
  const senhas = lerSenhasLocais();
  senhas[alvo] = { salt, hash, iteracoes: ITERACOES };
  try {
    localStorage.setItem(CHAVE_SENHAS_LOCAIS, JSON.stringify(senhas));
  } catch {
    throw new Error("Não consegui salvar a senha neste navegador (armazenamento bloqueado).");
  }
}
