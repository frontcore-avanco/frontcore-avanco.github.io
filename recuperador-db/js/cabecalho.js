// -----------------------------------------------------------------------
// cabecalho.js — lê o cabeçalho de 100 bytes de um arquivo SQLite (sem
// abrir o banco) pra dar um primeiro diagnóstico: é mesmo SQLite? o
// arquivo está inteiro ou truncado? está em modo WAL?
// -----------------------------------------------------------------------

const ASSINATURA = "SQLite format 3\u0000";

/** @param {ArrayBuffer} buffer primeiros bytes do arquivo (pelo menos 100)
 *  @param {number} tamanhoArquivo tamanho real do arquivo em bytes */
export function lerCabecalho(buffer, tamanhoArquivo) {
  const bytes = new Uint8Array(buffer);
  const vista = new DataView(buffer);
  const assinatura = String.fromCharCode(...bytes.slice(0, 16));
  if (bytes.length < 100 || assinatura !== ASSINATURA) {
    return { sqlite: false, tamanhoArquivo };
  }

  let tamanhoPagina = vista.getUint16(16, false);
  if (tamanhoPagina === 1) tamanhoPagina = 65536;
  const paginasNoCabecalho = vista.getUint32(28, false);
  const paginasNoArquivo = Math.floor(tamanhoArquivo / tamanhoPagina);
  const codificacoes = { 1: "UTF-8", 2: "UTF-16le", 3: "UTF-16be" };

  return {
    sqlite: true,
    tamanhoArquivo,
    tamanhoPagina,
    paginasNoCabecalho,
    paginasNoArquivo,
    // arquivo menor que o banco declara (cópia interrompida, disco cheio...)
    truncado: paginasNoCabecalho > 0 && paginasNoArquivo < paginasNoCabecalho,
    tamanhoQuebrado: tamanhoArquivo % tamanhoPagina !== 0,
    modoWal: bytes[18] === 2 || bytes[19] === 2,
    codificacao: codificacoes[vista.getUint32(56, false)] || "desconhecida",
  };
}
