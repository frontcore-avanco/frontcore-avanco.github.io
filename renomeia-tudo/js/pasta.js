// -----------------------------------------------------------------------
// pasta.js — leitura e renomeação de arquivos numa pasta escolhida pela
// pessoa, usando a File System Access API (Chrome e Edge). Tudo roda no
// navegador; nenhum arquivo sai do computador.
//
// Só o NOME muda: o arquivo é renomeado no lugar (handle.move). Se o
// navegador não tiver move(), cai pra copiar-e-apagar com conferência de
// tamanho, que preserva o conteúdo mas muda a data de modificação.
// -----------------------------------------------------------------------

export function suportaPastas() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function escolherPasta() {
  return window.showDirectoryPicker({ id: "renomeia-tudo", mode: "readwrite" });
}

/** Tudo que existe na pasta (só o primeiro nível): [{ nome, tipo }]. */
export async function listarEntradas(dir) {
  const entradas = [];
  for await (const [nome, handle] of dir.entries()) entradas.push({ nome, tipo: handle.kind });
  return entradas;
}

async function nomeEmUso(dir, nome) {
  for (const buscar of ["getFileHandle", "getDirectoryHandle"]) {
    try {
      await dir[buscar](nome);
      return true;
    } catch (e) {
      if (e.name !== "NotFoundError" && e.name !== "TypeMismatchError") throw e;
    }
  }
  return false;
}

async function copiarEApagar(dir, handle, de, para) {
  const arquivo = await handle.getFile();
  const novo = await dir.getFileHandle(para, { create: true });
  const escrita = await novo.createWritable();
  await escrita.write(arquivo);
  await escrita.close();

  const copiado = await novo.getFile();
  if (copiado.size !== arquivo.size) {
    await dir.removeEntry(para);
    throw new Error("A cópia saiu com tamanho diferente do original — o arquivo original foi mantido.");
  }
  await dir.removeEntry(de);
}

/** Renomeia `de` -> `para` dentro de `dir`. Lança erro com mensagem pra
 * mostrar na tela se não der (nome já existe, arquivo em uso, etc.). */
export async function renomearArquivo(dir, de, para) {
  const soMaiuscula = de.toLowerCase() === para.toLowerCase();
  if (!soMaiuscula && (await nomeEmUso(dir, para))) {
    throw new Error("Já existe um arquivo ou pasta com esse nome.");
  }

  let handle;
  try {
    handle = await dir.getFileHandle(de);
  } catch (e) {
    throw traduzirErro(e);
  }

  if (typeof handle.move === "function") {
    try {
      await handle.move(para);
      return;
    } catch (e) {
      if (e.name !== "NotSupportedError" && e.name !== "TypeError") throw traduzirErro(e);
    }
  }

  if (soMaiuscula) {
    throw new Error("Este navegador não consegue trocar só maiúsculas/minúsculas do nome.");
  }
  try {
    await copiarEApagar(dir, handle, de, para);
  } catch (e) {
    throw traduzirErro(e);
  }
}

function traduzirErro(e) {
  if (e.name === "NoModificationAllowedError" || e.name === "InvalidStateError") {
    return new Error("O arquivo está em uso por outro programa (feche-o e tente de novo).");
  }
  if (e.name === "NotAllowedError") return new Error("O navegador não tem permissão pra alterar esta pasta.");
  if (e.name === "NotFoundError") return new Error("O arquivo não foi encontrado (foi renomeado ou apagado por outro programa).");
  return e instanceof Error ? e : new Error(String(e));
}

/** Executa o plano (itens com status "ok") um por um. Devolve
 * { feitos: [{de, para}], falhas: [{de, para, erro}] }. Um erro num
 * arquivo não interrompe os outros. */
export async function executarRenomeacoes(dir, itens, aoProgredir) {
  const feitos = [];
  const falhas = [];
  const total = itens.length;
  for (let i = 0; i < total; i++) {
    const { nome, novo } = itens[i];
    try {
      await renomearArquivo(dir, nome, novo);
      feitos.push({ de: nome, para: novo });
    } catch (e) {
      falhas.push({ de: nome, para: novo, erro: e.message });
    }
    if (aoProgredir) aoProgredir(i + 1, total);
  }
  return { feitos, falhas };
}

/** Desfaz uma execução anterior (volta cada arquivo ao nome de antes),
 * na ordem inversa. */
export async function desfazerRenomeacoes(dir, feitos, aoProgredir) {
  const revertidos = [];
  const falhas = [];
  const total = feitos.length;
  for (let i = total - 1; i >= 0; i--) {
    const { de, para } = feitos[i];
    try {
      await renomearArquivo(dir, para, de);
      revertidos.push({ de: para, para: de });
    } catch (e) {
      falhas.push({ de: para, para: de, erro: e.message });
    }
    if (aoProgredir) aoProgredir(total - i, total);
  }
  return { revertidos, falhas };
}
