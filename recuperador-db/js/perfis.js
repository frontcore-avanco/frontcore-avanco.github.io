// -----------------------------------------------------------------------
// perfis.js — quais bancos o Recuperador conhece e como reconhecê-los.
// Sem dependência de navegador: recebe o nome do arquivo e a lista de
// tabelas e devolve o perfil. Cada perfil diz qual procedimento aplicar.
//
// Hoje os dois bancos usam o mesmo procedimento ("clone": copia tabela a
// tabela pra um banco novo, com leitura parcial quando há corrupção). Os
// perfis existem separados porque as regras específicas de cada banco
// (validações, estrutura esperada) vão ser definidas com os bancos reais.
// -----------------------------------------------------------------------

export const PERFIS = [
  {
    id: "satcfe",
    nome: "SatCFE.db",
    descricao: "Banco do SAT/CF-e do PDV (cupons, contingência e pendências).",
    // trechos do nome do arquivo (comparados sem pontuação e sem caixa)
    trechosNome: ["satcfe"],
    // tabelas que identificam esse banco pela estrutura
    tabelasAssinatura: ["CFe", "Contingencia", "ControleNFCe", "Chavespendentes", "CancelamentoPendencias"],
    minimoAssinatura: 3,
    procedimento: "clone",
    aConfirmar: false,
  },
  {
    id: "frenteavanco",
    nome: "frenteavanco.db",
    descricao: "Banco principal da Frente de Loja (Avanço).",
    trechosNome: ["frenteavanco"],
    // ainda não temos o schema real desse banco: por enquanto só o nome identifica
    tabelasAssinatura: [],
    minimoAssinatura: 0,
    procedimento: "clone",
    aConfirmar: true,
  },
];

export const PROCEDIMENTOS = {
  clone: "Cópia tabela a tabela para um banco novo, com leitura parcial das áreas danificadas",
};

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Reconhece o banco. Devolve { perfil, motivo } — `perfil` é null quando
 * nenhum bate (o chamador decide se segue com o procedimento padrão). */
export function identificarBanco(nomeArquivo, tabelas) {
  const nome = normalizar(nomeArquivo);
  const existentes = new Set((tabelas || []).map((t) => t.toLowerCase()));

  let porNome = null;
  let porEstrutura = null;
  for (const perfil of PERFIS) {
    if (!porNome && perfil.trechosNome.some((t) => nome.includes(t))) porNome = perfil;
    if (!porEstrutura && perfil.tabelasAssinatura.length) {
      const achadas = perfil.tabelasAssinatura.filter((t) => existentes.has(t.toLowerCase()));
      if (achadas.length >= perfil.minimoAssinatura) porEstrutura = { perfil, achadas };
    }
  }

  if (porEstrutura && porNome && porEstrutura.perfil.id !== porNome.id) {
    return {
      perfil: porEstrutura.perfil,
      motivo: `A estrutura das tabelas é de um ${porEstrutura.perfil.nome}, apesar do nome do arquivo sugerir ${porNome.nome}. Prevaleceu a estrutura.`,
    };
  }
  if (porEstrutura) {
    const e = porEstrutura;
    return {
      perfil: e.perfil,
      motivo:
        `Reconhecido pela estrutura (${e.achadas.length} tabelas características: ${e.achadas.join(", ")})` +
        (porNome ? " e pelo nome do arquivo." : "."),
    };
  }
  if (porNome) {
    return { perfil: porNome, motivo: "Reconhecido pelo nome do arquivo." };
  }
  return { perfil: null, motivo: "Nome e estrutura não correspondem a nenhum banco conhecido." };
}
