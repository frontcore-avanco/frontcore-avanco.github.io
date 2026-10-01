// -----------------------------------------------------------------------
// auth-client.js — fala com o backend do FrontCore Servidor (ver o
// repositório FrontCore-Servidor) pra login de verdade. Usado pela tela
// de login (login.js) e pelo "Sair" do dashboard.
//
// Troque API_BASE pro endereço público (desktop + Cloudflare Tunnel)
// assim que ele estiver no ar — é o único lugar que precisa mudar.
// -----------------------------------------------------------------------
export const API_BASE = "http://localhost:3000";

async function chamarApi(caminho, opcoes) {
  let resp;
  try {
    resp = await fetch(API_BASE + caminho, opcoes);
  } catch {
    throw new Error("Não consegui falar com o servidor do FrontCore. Verifique sua conexão e tente de novo.");
  }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || "Algo deu errado.");
  return dados;
}

export function login(email, senha) {
  return chamarApi("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
}

export function trocarSenha(token, novaSenha) {
  return chamarApi("/api/auth/trocar-senha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, novaSenha }),
  });
}

export async function logout(token) {
  try {
    await fetch(API_BASE + "/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    });
  } catch {
    // servidor fora do ar não deveria impedir o logout local
  }
}
