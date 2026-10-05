// -----------------------------------------------------------------------
// login.js — tela de entrada da equipe. A conferência de e-mail e senha
// (e a troca de senha no primeiro acesso) está em assets/js/auth-client.js,
// sem servidor; ver o aviso lá.
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

function showView(view) {
  for (const v of [viewLogin, viewNewpass, viewDone]) v.hidden = v !== view;
}

function entrar(token, usuario) {
  sessionStorage.setItem("frontcore_token", token);
  sessionStorage.setItem("frontcore_usuario", JSON.stringify(usuario));
  showView(viewDone);
  setTimeout(() => {
    window.location.href = "home/";
  }, 600);
}

let sessao = null; // { email, nome, token } enquanto a troca de senha não termina

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  btnLogin.disabled = true;
  const email = document.getElementById("login-email").value;
  try {
    const resultado = await login(email, document.getElementById("login-senha").value);
    if (resultado.precisaTrocarSenha) {
      sessao = { email, nome: resultado.nome, token: resultado.token };
      showView(viewNewpass);
    } else {
      entrar(resultado.token, { nome: resultado.nome, email: email.trim().toLowerCase() });
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
    await trocarSenha(sessao.email, nova);
    entrar(sessao.token, { nome: sessao.nome, email: sessao.email.trim().toLowerCase() });
  } catch (err) {
    newpassError.textContent = err.message;
    newpassError.hidden = false;
    btnNewpass.disabled = false;
  }
});
