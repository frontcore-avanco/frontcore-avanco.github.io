// -----------------------------------------------------------------------
// login.js — tela de entrada da equipe. A conferência de e-mail e senha
// está em assets/js/auth-client.js (sem servidor; ver o aviso lá).
// -----------------------------------------------------------------------
import { login } from "./assets/js/auth-client.js";

const viewLogin = document.getElementById("view-login");
const viewDone = document.getElementById("view-done");

const formLogin = document.getElementById("form-login");
const loginError = document.getElementById("login-error");
const btnLogin = formLogin.querySelector("button[type=submit]");

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  btnLogin.disabled = true;
  try {
    const { token } = await login(
      document.getElementById("login-email").value,
      document.getElementById("login-senha").value
    );
    sessionStorage.setItem("frontcore_token", token);

    viewLogin.hidden = true;
    viewDone.hidden = false;
    setTimeout(() => {
      window.location.href = "home/";
    }, 600);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
    btnLogin.disabled = false;
  }
});
