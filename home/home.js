// -----------------------------------------------------------------------
// home.js — monta a tela inicial a partir de dados.js e liga o que é
// interativo: busca global (Ctrl+K), filtros das ferramentas, menu do
// usuário, status, relógio e o menu lateral no celular.
// -----------------------------------------------------------------------
import { FERRAMENTAS, RECURSOS, LINKS, AJUDA, VANTAGENS } from "./dados.js";
import { icone } from "./icones.js";
import { MANUALS } from "../assets/js/manuals-data.js";
import { searchManuals } from "../assets/js/help-search.js";
import { USUARIOS } from "../assets/js/usuarios.js";

const $ = (id) => document.getElementById(id);

function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function ehExterno(href) {
  return /^https?:/i.test(href);
}

// ---- ações (itens que não navegam) ----------------------------------------
const ACOES = {
  "abrir-central-de-ajuda": () => {
    const botao = $("hw-button");
    if (botao && $("hw-panel").hidden) botao.click();
  },
};

// ---- cabeçalho --------------------------------------------------------------
function montarCabecalho() {
  $("logo-topo").innerHTML = '<img class="logo-img" src="../assets/img/logo-frontcore.webp" alt="FrontCore">';
  $("btn-menu").innerHTML = icone("menu");
  $("busca-icone").innerHTML = icone("search");
  $("btn-sino").innerHTML = icone("bell");
  $("usuario-seta").innerHTML = icone("chevron-down", "seta");
  $("sair-icone").innerHTML = icone("logout");
  $("icone-ferramentas").innerHTML = icone("grid");
  $("icone-recursos").innerHTML = icone("folder-open");
  $("icone-busca-ferramenta").innerHTML = icone("search");

  let usuario = {};
  try {
    usuario = JSON.parse(sessionStorage.getItem("frontcore_usuario")) || {};
  } catch {
    usuario = {};
  }
  const nome = usuario.nome || "Usuário";
  const partes = nome.split(/\s+/).filter(Boolean);
  const iniciais = ((partes[0]?.[0] || "?") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  $("avatar").textContent = iniciais;
  $("usuario-nome").textContent = nome;
  $("pop-nome").textContent = nome;
  $("pop-email").textContent = usuario.email || "";
}

function atualizarRelogio() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  $("relogio").textContent = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---- itens (menu lateral, links, ajuda) ----------------------------------------
function itemHtml(item, classe) {
  const conteudo = `${icone(item.icone)}<span class="item-texto">${item.titulo}</span>`;
  if (item.acao) return `<button type="button" class="${classe}" data-acao="${item.acao}">${conteudo}</button>`;
  const externo = ehExterno(item.href);
  const abrirFora = externo ? ' target="_blank" rel="noopener noreferrer"' : "";
  const setinha = externo ? `<span class="item-externo">${icone("external")}</span>` : "";
  return `<a class="${classe}" href="${item.href}"${abrirFora}>${conteudo}${setinha}</a>`;
}

function montarLateral() {
  $("lateral").innerHTML =
    `<a class="nav-item ativo" href="./">${icone("home")}<span class="item-texto">Início</span></a>` +
    `<p class="nav-titulo">Programas</p>` +
    FERRAMENTAS.map((f) => itemHtml({ ...f, href: f.href }, "nav-item")).join("") +
    `<hr class="nav-sep"><p class="nav-titulo">Recursos</p>` +
    RECURSOS.map((r) => itemHtml(r, "nav-item")).join("") +
    `<hr class="nav-sep"><p class="nav-titulo">Links externos</p>` +
    LINKS.map((l) => itemHtml(l, "nav-item")).join("") +
    `<hr class="nav-sep">` +
    `<a class="nav-item" href="../ajuda/">${icone("help-circle")}<span class="item-texto">Ajuda</span></a>`;
}

// ---- hero ------------------------------------------------------------------------------
function montarHero() {
  $("hero").innerHTML =
    `<div class="hero-banner"><img src="../assets/img/banner-frontcore.webp" alt="FrontCore — todas as ferramentas do suporte, em um só lugar."></div>` +
    `<ul class="vantagens">` +
    VANTAGENS.map(
      (v) =>
        `<li><span class="vant-icone">${icone(v.icone)}</span><div><strong>${v.titulo}</strong><span>${v.texto}</span></div></li>`
    ).join("") +
    `</ul>`;
}

// ---- cards -----------------------------------------------------------------------------------
function cardHtml(item) {
  const breve = item.status === "breve";
  const selo = `<span class="selo ${breve ? "selo-breve" : "selo-disponivel"}">${breve ? "Em breve" : "Disponível"}</span>`;
  const corpo =
    `<span class="card-icone cor-${item.cor}">${icone(item.icone)}</span>` +
    `<span class="card-corpo">${selo}<h3>${item.titulo}</h3><p>${item.desc}</p>` +
    `<span class="card-abrir">Abrir →</span></span>`;
  if (item.acao) return `<button type="button" class="card" data-acao="${item.acao}">${corpo}</button>`;
  return `<a class="card" href="${item.href}">${corpo}</a>`;
}

let filtroEstado = "todos";
let filtroTexto = "";

function montarFerramentas() {
  const q = normalizar(filtroTexto).trim();
  const visiveis = FERRAMENTAS.filter((f) => {
    if (filtroEstado !== "todos" && f.status !== filtroEstado) return false;
    return !q || normalizar(`${f.titulo} ${f.desc}`).includes(q);
  });
  $("grade-ferramentas").innerHTML = visiveis.map(cardHtml).join("");
  $("vazio-ferramentas").hidden = visiveis.length > 0;
}

function montarRecursos() {
  $("grade-recursos").innerHTML = RECURSOS.map((r) => cardHtml({ ...r, status: "disponivel" })).join("");
}

// ---- painel da direita -------------------------------------------------------------------
const STATUS_INICIAL = [
  { id: "plataforma", icone: "shield", texto: "Plataforma operacional", valor: "OK", tom: "ok" },
  { id: "ferramentas", icone: "gear", texto: "Ferramentas", valor: "...", tom: "neutro" },
  { id: "acesso", icone: "users", texto: "Acesso da equipe (login)", valor: "...", tom: "neutro" },
  { id: "servidor", icone: "database", texto: "Servidor próprio", valor: "Em breve", tom: "neutro" },
];

function linhaStatus(s) {
  return (
    `<li data-status="${s.id}"><span class="status-icone">${icone(s.icone)}</span>` +
    `<span class="status-texto">${s.texto}</span><span class="status-valor tom-${s.tom}">${s.valor}</span></li>`
  );
}

function definirStatus(id, valor, tom) {
  const li = document.querySelector(`[data-status="${id}"] .status-valor`);
  if (!li) return;
  li.textContent = valor;
  li.className = `status-valor tom-${tom}`;
}

async function verificarStatus() {
  definirStatus("acesso", USUARIOS.length ? "OK" : "Sem contas", USUARIOS.length ? "ok" : "alerta");

  const disponiveis = FERRAMENTAS.filter((f) => f.status === "disponivel");
  const respostas = await Promise.all(
    disponiveis.map((f) =>
      fetch(f.href, { method: "HEAD", cache: "no-store" })
        .then((r) => r.ok)
        .catch(() => false)
    )
  );
  const falhas = respostas.filter((ok) => !ok).length;
  definirStatus("ferramentas", falhas ? `${falhas} com falha` : "OK", falhas ? "alerta" : "ok");
}

function montarDireita() {
  $("direita").innerHTML =
    `<section class="painel"><header class="painel-topo"><h2>Status do Sistema</h2>` +
    `<span class="online"><span class="ponto"></span>Online</span></header>` +
    `<ul class="lista-status">${STATUS_INICIAL.map(linhaStatus).join("")}</ul></section>` +
    painelSefaz() +
    `<section class="painel"><header class="painel-topo"><h2>Links Rápidos</h2>${icone("external", "painel-icone")}</header>` +
    `<ul class="lista-links">${LINKS.map((l) => `<li>${itemHtml(l, "link-item")}</li>`).join("")}</ul></section>` +
    `<section class="painel"><header class="painel-topo"><h2>${icone("help-circle", "painel-icone-esq")}Ajuda e Suporte</h2></header>` +
    `<ul class="lista-links">${AJUDA.map((a) => `<li>${itemHtml(a, "link-item")}</li>`).join("")}</ul></section>`;
}

// ---- SEFAZ MG ---------------------------------------------------------------------------
// Um robô do GitHub (.github/workflows/status-sefaz.yml) consulta o monitor
// da Zorte a cada 10 minutos e publica o resultado nesta branch; aqui só
// lemos esse arquivo. O que aparece é o estado do monitor independente, não
// um comunicado oficial da SEFAZ.
const URL_SEFAZ = "https://raw.githubusercontent.com/frontcore-avanco/frontcore-avanco.github.io/status-data/sefaz-mg.json";
const LIMITE_DESATUALIZADO_MIN = 45;
const TOM_SEFAZ = {
  normal: "verde",
  instavel: "amarelo",
  lentidao: "laranja",
  parada: "vermelho",
  contingencia: "azul",
  desconhecido: "cinza",
  indisponivel: "cinza",
};

function painelSefaz() {
  const linha = (id, nome) =>
    `<li data-sefaz="${id}"><span class="semaforo tom-cinza"></span><span class="sefaz-doc">${nome}</span>` +
    `<span class="sefaz-estado">Verificando...</span></li>`;
  return (
    `<section class="painel" id="painel-sefaz"><header class="painel-topo"><h2>SEFAZ MG</h2>` +
    `<span class="sefaz-hora" id="sefaz-hora"></span></header>` +
    `<ul class="lista-sefaz">${linha("nfce", "NFC-e")}${linha("nfe", "NF-e")}</ul>` +
    `<p class="sefaz-rodape">Monitor independente, não é o comunicado oficial da SEFAZ. ` +
    `Conferir: <a href="https://monitor.zorte.com.br/nfce" target="_blank" rel="noopener noreferrer">Zorte</a> · ` +
    `<a href="https://monitor.tecnospeed.com.br/?filter-doc=nfce&filter-uf=mg" target="_blank" rel="noopener noreferrer">Tecnospeed</a></p></section>`
  );
}

function definirSefaz(id, texto, tom) {
  const li = document.querySelector(`[data-sefaz="${id}"]`);
  if (!li) return;
  li.querySelector(".semaforo").className = `semaforo tom-${tom}`;
  const estado = li.querySelector(".sefaz-estado");
  estado.textContent = texto;
  estado.className = `sefaz-estado texto-${tom}`;
}

async function carregarSefaz() {
  let dados = null;
  try {
    const resp = await fetch(URL_SEFAZ, { cache: "no-store" });
    if (resp.ok) dados = await resp.json();
  } catch {
    dados = null;
  }

  const idadeMin = dados ? (Date.now() - new Date(dados.atualizadoEm).getTime()) / 60000 : Infinity;
  if (!dados || !(idadeMin <= LIMITE_DESATUALIZADO_MIN)) {
    for (const id of ["nfce", "nfe"]) definirSefaz(id, dados ? "Dados desatualizados" : "Sem dados", "cinza");
    $("sefaz-hora").textContent = dados
      ? `última leitura ${new Date(dados.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
      : "";
    return;
  }

  for (const id of ["nfce", "nfe"]) {
    const d = dados.docs?.[id];
    if (!d) definirSefaz(id, "Sem dados", "cinza");
    else definirSefaz(id, d.rotulo, TOM_SEFAZ[d.estado] || "cinza");
  }
  const hora = new Date(dados.atualizadoEm);
  const p = (n) => String(n).padStart(2, "0");
  $("sefaz-hora").textContent = `atualizado às ${p(hora.getHours())}:${p(hora.getMinutes())}`;
}

// ---- busca global (Ctrl+K) ----------------------------------------------------------------
const TIPOS = { ferramenta: "Ferramenta", recurso: "Recurso", link: "Link", ajuda: "Ajuda", manual: "Manual" };

function indiceDeBusca() {
  return [
    ...FERRAMENTAS.map((f) => ({ tipo: "ferramenta", titulo: f.titulo, texto: f.desc, href: f.href, icone: f.icone })),
    ...RECURSOS.map((r) => ({ tipo: "recurso", titulo: r.titulo, texto: r.desc, href: r.href, acao: r.acao, icone: r.icone })),
    ...LINKS.map((l) => ({ tipo: "link", titulo: l.titulo, texto: "", busca: l.busca, href: l.href, icone: l.icone })),
    ...AJUDA.map((a) => ({ tipo: "ajuda", titulo: a.titulo, texto: "", href: a.href, icone: a.icone })),
  ];
}

let resultadosBusca = [];
let indiceAtivo = -1;

function buscar(consulta) {
  const q = normalizar(consulta).trim();
  const indice = indiceDeBusca();
  if (!q) return indice.filter((i) => i.tipo === "ferramenta").slice(0, 6);

  const palavras = q.split(/\s+/);
  const diretos = indice
    .filter((i) => {
      const alvo = normalizar(`${i.titulo} ${i.texto} ${i.busca || ""}`);
      return palavras.every((p) => alvo.includes(p));
    })
    .sort((a, b) => Number(normalizar(b.titulo).includes(q)) - Number(normalizar(a.titulo).includes(q)));

  const manuais = searchManuals(consulta, MANUALS, 3).map((m) => ({
    tipo: "manual",
    titulo: m.secaoTitulo,
    texto: m.manualTitulo,
    href: `../manuais/#${m.manualId}`,
    icone: "book-doc",
  }));
  return [...diretos, ...manuais].slice(0, 9);
}

function desenharResultados() {
  const caixa = $("busca-resultados");
  if (!resultadosBusca.length) {
    caixa.innerHTML = `<p class="busca-vazio">Nada encontrado. Tente outra palavra.</p>`;
    return;
  }
  caixa.innerHTML = resultadosBusca
    .map((r, i) => {
      const interno = r.acao ? `data-acao="${r.acao}"` : `href="${r.href}"${ehExterno(r.href) ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
      const tag = r.acao ? "button type=\"button\"" : "a";
      const fecha = r.acao ? "button" : "a";
      return (
        `<${tag} class="resultado${i === indiceAtivo ? " ativo" : ""}" role="option" id="res-${i}" ${interno}>` +
        `<span class="resultado-icone">${icone(r.icone)}</span>` +
        `<span class="resultado-corpo"><strong>${r.titulo}</strong>${r.texto ? `<span>${r.texto}</span>` : ""}</span>` +
        `<span class="resultado-tipo">${TIPOS[r.tipo]}</span></${fecha}>`
      );
    })
    .join("");
}

function abrirBusca() {
  resultadosBusca = buscar($("busca-input").value);
  indiceAtivo = -1;
  desenharResultados();
  $("busca-resultados").hidden = false;
  $("busca-input").setAttribute("aria-expanded", "true");
}

function fecharBusca() {
  $("busca-resultados").hidden = true;
  $("busca-input").setAttribute("aria-expanded", "false");
  indiceAtivo = -1;
}

function marcarAtivo(novo) {
  if (!resultadosBusca.length) return;
  indiceAtivo = (novo + resultadosBusca.length) % resultadosBusca.length;
  desenharResultados();
  $(`res-${indiceAtivo}`)?.scrollIntoView({ block: "nearest" });
}

function ativarResultado(i) {
  const r = resultadosBusca[i];
  if (!r) return;
  fecharBusca();
  if (r.acao) {
    ACOES[r.acao]?.();
  } else if (ehExterno(r.href)) {
    window.open(r.href, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = r.href;
  }
}

function ligarBusca() {
  const input = $("busca-input");
  input.addEventListener("focus", abrirBusca);
  input.addEventListener("input", abrirBusca);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); marcarAtivo(indiceAtivo + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); marcarAtivo(indiceAtivo - 1); }
    else if (e.key === "Enter") { e.preventDefault(); ativarResultado(indiceAtivo >= 0 ? indiceAtivo : 0); }
    else if (e.key === "Escape") { fecharBusca(); input.blur(); }
  });
  $("busca-resultados").addEventListener("click", (e) => {
    const alvo = e.target.closest(".resultado");
    if (!alvo) return;
    if (alvo.tagName === "BUTTON") {
      e.preventDefault();
      fecharBusca();
      ACOES[alvo.dataset.acao]?.();
    } else {
      fecharBusca();
    }
  });
  document.addEventListener("keydown", (e) => {
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === "/" && !digitando) {
      e.preventDefault();
      input.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!$("busca-global").contains(e.target)) fecharBusca();
  });
}

// ---- popovers (sino, usuário) ----------------------------------------------------------------
function ligarPopover(botaoId, popId) {
  const botao = $(botaoId);
  const pop = $(popId);
  botao.addEventListener("click", (e) => {
    e.stopPropagation();
    const abrir = pop.hidden;
    for (const outro of document.querySelectorAll(".popover")) outro.hidden = true;
    for (const b of [$("btn-sino"), $("btn-usuario")]) b.setAttribute("aria-expanded", "false");
    pop.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
  });
}

function fecharPopovers() {
  for (const pop of document.querySelectorAll(".popover")) pop.hidden = true;
  for (const b of [$("btn-sino"), $("btn-usuario")]) b.setAttribute("aria-expanded", "false");
}

// ---- menu lateral (celular) ----------------------------------------------------------------------
function alternarMenu(abrir) {
  document.body.classList.toggle("menu-aberto", abrir);
  $("scrim").hidden = !abrir;
  $("btn-menu").setAttribute("aria-expanded", String(abrir));
}

// ---- início ---------------------------------------------------------------------------------------------
montarCabecalho();
montarLateral();
montarHero();
montarFerramentas();
montarRecursos();
montarDireita();
ligarBusca();
ligarPopover("btn-sino", "pop-sino");
ligarPopover("btn-usuario", "pop-usuario");
atualizarRelogio();
setInterval(atualizarRelogio, 20000);
verificarStatus();
carregarSefaz();
setInterval(carregarSefaz, 5 * 60 * 1000);

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-sino, .menu-usuario")) fecharPopovers();
  const acao = e.target.closest("[data-acao]");
  if (acao && !acao.closest("#busca-resultados")) {
    ACOES[acao.dataset.acao]?.();
    alternarMenu(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    fecharPopovers();
    alternarMenu(false);
  }
});

$("filtros").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filtroEstado = chip.dataset.filtro;
  for (const c of document.querySelectorAll(".chip")) c.classList.toggle("ativo", c === chip);
  montarFerramentas();
});
$("filtro-texto").addEventListener("input", (e) => {
  filtroTexto = e.target.value;
  montarFerramentas();
});

$("btn-menu").addEventListener("click", () => alternarMenu(!document.body.classList.contains("menu-aberto")));
$("scrim").addEventListener("click", () => alternarMenu(false));
$("lateral").addEventListener("click", (e) => {
  if (e.target.closest("a")) alternarMenu(false);
});

$("link-sair").addEventListener("click", () => {
  sessionStorage.removeItem("frontcore_token");
  sessionStorage.removeItem("frontcore_usuario");
});
