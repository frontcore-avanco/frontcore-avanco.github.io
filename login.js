// -----------------------------------------------------------------------
// login.js — login de verdade contra o backend do FrontCore Servidor
// (ver assets/js/auth-client.js). Troca de senha obrigatória só no
// primeiro acesso de cada pessoa (ou depois de um reset feito por quem
// administra as contas); nos próximos logins é só e-mail + senha.
// -----------------------------------------------------------------------
import { login, trocarSenha } from "./assets/js/auth-client.js";

const viewLogin = document.getElementById("view-login");
const viewNewpass = document.getElementById("view-newpass");
const viewDone = document.getElementById("view-done");

const formLogin = document.getElementById("form-login");
const loginError = document.getElementById("login-error");
const btnLogin = formLogin.querySelector("button[type=submit]");

const formNewpass = document.getElementById("form-newpass");
const newpassError = document.getElementById("newpass-error");
const btnNewpass = formNewpass.querySelector("button[type=submit]");

const doneTitulo = document.getElementById("done-titulo");
const doneMensagem = document.getElementById("done-mensagem");

function showView(view) {
  for (const v of [viewLogin, viewNewpass, viewDone]) v.hidden = v !== view;
}

/** Mostra a tela final com uma mensagem e manda pro dashboard logo em
 * seguida — o link "Entrar no FrontCore →" na tela continua funcionando
 * como alternativa, caso o redirecionamento automático falhe por algum
 * motivo. */
function irParaHomeEm(ms, titulo, mensagem) {
  doneTitulo.textContent = titulo;
  doneMensagem.textContent = mensagem;
  showView(viewDone);
  setTimeout(() => {
    window.location.href = "home/";
  }, ms);
}

let tokenAtual = null;

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  btnLogin.disabled = true;
  try {
    const resultado = await login(
      document.getElementById("login-email").value,
      document.getElementById("login-senha").value
    );
    tokenAtual = resultado.token;
    sessionStorage.setItem("frontcore_token", resultado.token);

    if (resultado.precisaTrocarSenha) {
      showView(viewNewpass);
    } else {
      irParaHomeEm(600, "Login confirmado", "Entrando...");
    }
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    btnLogin.disabled = false;
  }
});

formNewpass.addEventListener("submit", async (e) => {
  e.preventDefault();
  newpassError.hidden = true;

  const nova = document.getElementById("nova-senha").value;
  const confirma = document.getElementById("confirma-senha").value;

  if (nova.length < 8) {
    newpassError.textContent = "A nova senha precisa ter pelo menos 8 caracteres.";
    newpassError.hidden = false;
    return;
  }
  if (nova !== confirma) {
    newpassError.textContent = "As duas senhas digitadas não são iguais.";
    newpassError.hidden = false;
    return;
  }

  btnNewpass.disabled = true;
  try {
    await trocarSenha(tokenAtual, nova);
    irParaHomeEm(900, "Senha alterada", "Entrando...");
  } catch (err) {
    newpassError.textContent = err.message;
    newpassError.hidden = false;
  } finally {
    btnNewpass.disabled = false;
  }
});
