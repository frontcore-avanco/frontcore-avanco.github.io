// -----------------------------------------------------------------------
// icones.js — ícones de linha (SVG inline, 24x24) e o logo do FrontCore.
// Tudo desenhado aqui mesmo, sem imagem nem biblioteca externa. Se a
// Avanço tiver o logo oficial em arquivo, é só trocar `logoMarca` e
// `logoCompleto` por uma <img>.
// -----------------------------------------------------------------------

const CAMINHOS = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  building: "M4 21V5l9-2v18M13 9h7v12M8 8h2M8 12h2M8 16h2M16 13h2M16 17h2M3 21h18",
  "file-doc": "M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6",
  "scan-check": "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8.5 12l2.5 2.5 4.5-5",
  rename: "M4 7h11M4 12h7M4 17h11M17 9v8M15 9h4M15 17h4",
  bars: "M5 20v-9M12 20V4M19 20v-6M3 20h18",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  download: "M12 3v12M7 10l5 5 5-5M4 20h16",
  "book-doc": "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  robot: "M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM12 8V4M10 13h.01M14 13h.01M9 17h6",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM17 19c0 1.5-2 2-5 2",
  "book-open": "M2 5c3-1 7-1 10 1 3-2 7-2 10-1v14c-3-1-7-1-10 1-3-2-7-2-10-1zM12 6v14",
  gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  avanco: "M12 3L4 21M12 3l8 18M8.5 15h7",
  "credit-card": "M3 6h18v12H3zM3 10h18M7 15h4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  kanban: "M3 4h18v16H3zM9 4v16M15 4v16M6 8v4M12 8v7M18 8v3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  "help-circle": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  "chevron-down": "M6 9l6 6 6-6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a2.5 2.5 0 1 0 0-5M17 14a5 5 0 0 1 4 6",
  "folder-open": "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  logout: "M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9",
  menu: "M4 6h16M4 12h16M4 18h16",
  alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
  "check-circle": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  close: "M6 6l12 12M18 6L6 18",
};

/** Ícone de linha pronto pra colocar em innerHTML. */
export function icone(nome, classe = "") {
  const d = CAMINHOS[nome] || CAMINHOS["help-circle"];
  return (
    `<svg class="icone ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="${d}"/></svg>`
  );
}

/** Marca (A estilizado com a curva verde-limão). O degradê "lg-verde" é
 * declarado uma vez só no index.html, pra não repetir o id. */
export function logoMarca(classe = "") {
  return (
    `<svg class="logo-marca ${classe}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<path d="M6 94 L44 6 H60 L28 94 Z" fill="#0a1a7c"/>` +
    `<path d="M50 6 H66 L94 94 H76 Z" fill="#0b2a9a"/>` +
    `<path d="M3 62 C 30 78, 62 62, 92 28 C 70 70, 30 92, 3 62 Z" fill="url(#lg-verde)"/>` +
    `</svg>`
  );
}

/** Marca + nome "FrontCore" (Front azul, Core verde). */
export function logoCompleto(classe = "") {
  return (
    `<span class="logo-completo ${classe}">${logoMarca()}` +
    `<span class="logo-texto"><span class="logo-front">Front</span><span class="logo-core">Core</span></span></span>`
  );
}
