// -----------------------------------------------------------------------
// gerar-usuario.mjs — cria (ou redefine a senha de) contas da equipe em
// assets/js/usuarios.js. Cada conta recebe uma senha aleatória, impressa
// uma única vez no terminal — repasse pra pessoa por um canal privado.
// O arquivo só guarda o hash, então a senha não dá pra recuperar depois:
// se alguém esquecer, rode de novo pro mesmo e-mail e repasse a nova.
//
// Uso:
//   node ferramentas/gerar-usuario.mjs "Nome Sobrenome:email@avancoinfo.com.br" "Outro Nome:outro@avancoinfo.com.br"
//
// Depois: git add assets/js/usuarios.js && git commit && git push
// -----------------------------------------------------------------------
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ITERACOES = 210000;
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/l/I

const arquivo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "js", "usuarios.js");
// lê o array como JSON em vez de importar o módulo: o .js do site é ESM
// e o Node só o trataria assim se houvesse um package.json "type": "module".
const USUARIOS = JSON.parse(/export const USUARIOS = (\[[\s\S]*\]);/.exec(fs.readFileSync(arquivo, "utf-8"))[1]);

function senhaAleatoria(tamanho = 12) {
  let s = "";
  for (let i = 0; i < tamanho; i++) s += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return s;
}

const entradas = process.argv.slice(2);
if (!entradas.length) {
  console.error('Uso: node ferramentas/gerar-usuario.mjs "Nome:email@dominio" ...');
  process.exit(1);
}

const usuarios = [...USUARIOS];
const resumo = [];

for (const entrada of entradas) {
  const [nome, email] = entrada.split(":").map((p) => p?.trim());
  if (!nome || !email || !email.includes("@")) {
    console.error(`Ignorando "${entrada}" — formato esperado "Nome:email@dominio".`);
    continue;
  }
  const senha = senhaAleatoria();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(senha, Buffer.from(salt, "hex"), ITERACOES, 32, "sha256").toString("hex");

  const novo = { nome, email: email.toLowerCase(), salt, hash, iteracoes: ITERACOES };
  const idx = usuarios.findIndex((u) => u.email.toLowerCase() === novo.email);
  if (idx >= 0) usuarios[idx] = novo;
  else usuarios.push(novo);
  resumo.push(`${nome} <${novo.email}>  →  senha: ${senha}${idx >= 0 ? "  (senha redefinida)" : ""}`);
}

const conteudo =
  "// Gerado por ferramentas/gerar-usuario.mjs — não edite à mão.\n" +
  "// Só guarda o hash das senhas, nunca a senha em si.\n" +
  `export const USUARIOS = ${JSON.stringify(usuarios, null, 2)};\n`;
fs.writeFileSync(arquivo, conteudo, "utf-8");

console.log("\nContas atualizadas em assets/js/usuarios.js:\n");
console.log(resumo.join("\n"));
console.log("\nAnote as senhas agora — elas não aparecem de novo. Depois é só commitar e publicar o arquivo.\n");
