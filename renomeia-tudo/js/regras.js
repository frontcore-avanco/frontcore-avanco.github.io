// -----------------------------------------------------------------------
// regras.js — as regras do Renomeia Tudo, sem nenhuma dependência do
// navegador (só recebe nomes e devolve nomes). Quem lê/renomeia arquivos
// de verdade é pasta.js; aqui só se decide COMO cada nome vai ficar e se
// isso é permitido.
//
// Três operações, sempre sobre o nome — o conteúdo do arquivo nunca é
// tocado:
// - substituir: troca um trecho de texto por outro (no nome, na extensão
//   ou nos dois);
// - remover:    apaga N caracteres a partir de uma posição;
// - renomear:   troca N caracteres a partir de uma posição por um texto
//   novo (com N = 0, só insere o texto naquela posição).
// -----------------------------------------------------------------------

/** Separa "relatorio.final.txt" em base "relatorio.final" e ext "txt".
 * Arquivo sem ponto, que começa com ponto (".gitignore") ou termina com
 * ponto não tem extensão. */
export function separarNomeExtensao(nomeCompleto) {
  const i = nomeCompleto.lastIndexOf(".");
  if (i <= 0 || i === nomeCompleto.length - 1) return { base: nomeCompleto, ext: "" };
  return { base: nomeCompleto.slice(0, i), ext: nomeCompleto.slice(i + 1) };
}

function juntar(base, ext) {
  return ext ? `${base}.${ext}` : base;
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Substitui `procurar` por `trocarPor` em `texto` (sem interpretar `$`
 * no texto novo — "$1" digitado pela pessoa vira "$1" mesmo). */
function substituirTexto(texto, { procurar, trocarPor, diferenciarMaiusculas, todasOcorrencias }) {
  const flags = (todasOcorrencias ? "g" : "") + (diferenciarMaiusculas ? "" : "i");
  return texto.replace(new RegExp(escaparRegex(procurar), flags), () => trocarPor);
}

/** Aplica um trecho posicional (remover/renomear) sobre `base`. Posição 1
 * é o primeiro caractere (ou o último, quando contando do fim). Conta
 * caracteres de verdade (não pedaços de UTF-16), então "ç" e emojis
 * valem 1. Devolve null se a posição cai fora do nome. */
function editarPorPosicao(base, { contarDe, posicao, quantidade }, textoNovo) {
  const chars = Array.from(base);
  const total = chars.length;

  let inicio;
  if (contarDe === "fim") inicio = total - posicao - quantidade + 1;
  else inicio = posicao - 1;

  if (quantidade > 0 && (inicio >= total || inicio + quantidade <= 0)) return null;
  if (quantidade === 0 && (inicio < 0 || inicio > total)) return null;

  const ini = Math.max(0, Math.min(inicio, total));
  const fim = Math.max(ini, Math.min(inicio + quantidade, total));
  return chars.slice(0, ini).join("") + textoNovo + chars.slice(fim).join("");
}

/** Mensagem de erro se as opções escolhidas não formam uma regra válida;
 * null se estiver tudo certo. */
export function validarConfig(config) {
  if (config.operacao === "substituir") {
    if (!config.procurar) return "Informe o texto que deve ser procurado.";
    return null;
  }
  if (!Number.isInteger(config.posicao) || config.posicao < 1) return "A posição precisa ser um número a partir de 1.";
  const minimo = config.operacao === "renomear" ? 0 : 1;
  if (!Number.isInteger(config.quantidade) || config.quantidade < minimo) {
    return config.operacao === "renomear"
      ? "A quantidade de caracteres precisa ser 0 ou mais."
      : "A quantidade de caracteres precisa ser 1 ou mais.";
  }
  if (config.operacao === "renomear" && config.quantidade === 0 && !config.novoTexto) {
    return "Com quantidade 0 é preciso informar o texto a inserir.";
  }
  if (config.operacao === "renomear" && config.quantidade > 0 && config.novoTexto === undefined) {
    return "Informe o novo texto.";
  }
  return null;
}

/** Calcula o nome novo de UM arquivo. Devolve { nome } com o resultado
 * (pode ser igual ao original) ou { aviso } quando a regra não se aplica
 * a esse nome (ex: posição além do tamanho do nome). */
export function aplicarOperacao(nomeCompleto, config) {
  const { base, ext } = separarNomeExtensao(nomeCompleto);

  if (config.operacao === "substituir") {
    const opcoes = { ...config };
    if (config.alvo === "extensao") {
      if (!ext) return { nome: nomeCompleto };
      opcoes.procurar = config.procurar.replace(/^\.+/, "");
      opcoes.trocarPor = config.trocarPor.replace(/^\.+/, "");
      if (!opcoes.procurar) return { nome: nomeCompleto };
      return { nome: juntar(base, substituirTexto(ext, opcoes)) };
    }
    if (config.alvo === "completo") return { nome: substituirTexto(nomeCompleto, opcoes) };
    const novaBase = substituirTexto(base, opcoes);
    if (!novaBase) return { aviso: "O nome ficaria vazio." };
    return { nome: juntar(novaBase, ext) };
  }

  const textoNovo = config.operacao === "renomear" ? config.novoTexto ?? "" : "";
  const novaBase = editarPorPosicao(base, config, textoNovo);
  if (novaBase === null) return { aviso: "A posição escolhida está além do tamanho do nome." };
  if (!novaBase) return { aviso: "O nome ficaria vazio." };
  return { nome: juntar(novaBase, ext) };
}

const NOMES_RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Mensagem se o Windows não aceitaria esse nome de arquivo; null se ok. */
export function validarNomeArquivo(nome) {
  if (!nome || !nome.trim()) return "O nome ficaria vazio.";
  if (/^\.+$/.test(nome)) return "O nome não pode ser só pontos.";
  const { base } = separarNomeExtensao(nome);
  if (!base.trim()) return "O nome (antes da extensão) ficaria vazio.";
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(nome)) return 'O nome não pode ter \\ / : * ? " < > |';
  if (/[. ]$/.test(nome)) return "O nome não pode terminar com ponto ou espaço.";
  if (NOMES_RESERVADOS.test(nome.split(".")[0])) return "Esse nome é reservado pelo Windows.";
  if (nome.length > 255) return "O nome passaria de 255 caracteres.";
  return null;
}

/** Monta a prévia: pra cada arquivo, o nome novo e a situação.
 * `entradas` = [{ nome, tipo: "file" | "directory" }] (tudo que existe
 * na pasta; só arquivos são renomeados, mas pastas ocupam nomes também).
 *
 * Situações: "ok" (será renomeado), "igual" (a regra não muda nada),
 * "invalido" (nome não permitido ou regra não se aplica), "conflito"
 * (outro arquivo/pasta já tem esse nome, ou dois arquivos ficariam com o
 * mesmo). Conflito é conservador: se o destino é o nome ATUAL de outro
 * arquivo, bloqueia mesmo que esse outro também vá mudar. */
export function planejar(entradas, config) {
  const arquivos = entradas
    .filter((e) => e.tipo === "file")
    .sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: "base" }));

  const itens = arquivos.map((e) => {
    const r = aplicarOperacao(e.nome, config);
    if (r.aviso) return { nome: e.nome, novo: e.nome, status: "invalido", mensagem: r.aviso };
    if (r.nome === e.nome) return { nome: e.nome, novo: e.nome, status: "igual", mensagem: "" };
    const erro = validarNomeArquivo(r.nome);
    if (erro) return { nome: e.nome, novo: r.nome, status: "invalido", mensagem: erro };
    return { nome: e.nome, novo: r.nome, status: "ok", mensagem: "" };
  });

  const ocupados = new Map(); // nome (minúsculo) -> quantas entradas têm esse nome hoje
  for (const e of entradas) ocupados.set(e.nome.toLowerCase(), (ocupados.get(e.nome.toLowerCase()) || 0) + 1);

  const porDestino = new Map();
  for (const it of itens) {
    if (it.status !== "ok") continue;
    const chave = it.novo.toLowerCase();
    porDestino.set(chave, (porDestino.get(chave) || 0) + 1);
  }

  for (const it of itens) {
    if (it.status !== "ok") continue;
    const chave = it.novo.toLowerCase();
    const ehOProprio = chave === it.nome.toLowerCase(); // só mudou maiúscula/minúscula
    if (!ehOProprio && ocupados.has(chave)) {
      it.status = "conflito";
      it.mensagem = "Já existe um arquivo ou pasta com esse nome.";
    } else if (porDestino.get(chave) > 1) {
      it.status = "conflito";
      it.mensagem = "Mais de um arquivo ficaria com esse nome.";
    }
  }

  const contagem = { ok: 0, igual: 0, invalido: 0, conflito: 0 };
  for (const it of itens) contagem[it.status]++;
  return { itens, contagem };
}
