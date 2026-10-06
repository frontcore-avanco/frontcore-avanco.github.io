// -----------------------------------------------------------------------
// dados.js — tudo que aparece na tela inicial (menu lateral, cards,
// links rápidos, busca) sai destas listas. Pra adicionar uma ferramenta
// ou um link novo, é só acrescentar um item aqui.
//
// `href` é relativo a /home/. Item sem `href` mas com `acao` não navega:
// chama a ação (ver home.js).
// -----------------------------------------------------------------------

export const FERRAMENTAS = [
  {
    id: "criador-de-cupons",
    titulo: "Criador de Cupons",
    desc: "Recria e gera cupons fiscais (NFC-e) a partir do XML, direto no navegador.",
    href: "../criador-de-cupons/",
    icone: "receipt",
    cor: "verde",
    status: "disponivel",
  },
  {
    id: "consulta-ambiente",
    titulo: "Consulta Ambiente",
    desc: "Consulte ambiente, número da loja e código da filial pelo CNPJ.",
    href: "../consulta-ambiente/",
    icone: "building",
    cor: "azul",
    status: "beta",
  },
  {
    id: "xml-para-csv",
    titulo: "XML para CSV",
    desc: "Converte XMLs de NF-e/NFC-e para planilha CSV (Excel).",
    href: "../xml-para-csv/",
    icone: "file-doc",
    cor: "roxo",
    status: "disponivel",
  },
  {
    id: "confere-diferenca",
    titulo: "Confere Diferença",
    desc: "Compara arquivos do Integral ou da Saída com o Tramitador e identifica divergências entre notas.",
    href: "../confere-diferenca/",
    icone: "scan-check",
    cor: "laranja",
    status: "disponivel",
  },
  {
    id: "renomeia-tudo",
    titulo: "Renomeia Tudo",
    desc: "Renomeia, remove ou troca partes do nome de vários arquivos de uma pasta de uma vez.",
    href: "../renomeia-tudo/",
    icone: "rename",
    cor: "amarelo",
    status: "disponivel",
  },
  {
    id: "recuperador-db",
    titulo: "Recuperador de Banco",
    desc: "Recupera bancos do PDV (frenteavanco.db e SatCFE.db) com erro de corrupção e gera uma cópia corrigida.",
    href: "../recuperador-db/",
    icone: "database",
    cor: "azul",
    status: "beta",
  },
  {
    id: "painel-ana",
    titulo: "Painel ANA",
    desc: "Gestor ANA: programa (.exe) instalado na máquina do cliente. Em desenvolvimento.",
    href: "../painel-ana/",
    icone: "bars",
    cor: "rosa",
    status: "breve",
  },
  {
    id: "replicador-pdv",
    titulo: "Replicador de PDV",
    desc: "Programa (.exe) local que replica e reconfigura PDVs pela rede do cliente. Em desenvolvimento.",
    href: "../replicador-pdv/",
    icone: "monitor",
    cor: "turquesa",
    status: "breve",
  },
];

export const RECURSOS = [
  {
    id: "downloads",
    titulo: "Downloads",
    desc: "Programas, drivers e ferramentas de suporte (balança, impressoras, pinpad, Linux e mais).",
    href: "../downloads/",
    icone: "download",
    cor: "lavanda",
  },
  {
    id: "manuais",
    titulo: "Manuais e Procedimentos",
    desc: "Manuais técnicos, tutoriais e procedimentos da equipe.",
    href: "../manuais/",
    icone: "book-doc",
    cor: "azul",
  },
  {
    id: "ask",
    titulo: "Ask (Pesquisa inteligente)",
    desc: "Encontre manuais e soluções por assunto (ex.: balança Toledo).",
    acao: "abrir-central-de-ajuda",
    icone: "robot",
    cor: "roxo",
  },
];

export const LINKS = [
  { titulo: "Atendimento Avanço", busca: "chamados suporte atendimentos avancao", href: "https://www.avancao.com.br/suporte/atendimentos", icone: "headset" },
  { titulo: "Base de Conhecimento", busca: "bc avanco manuais artigos", href: "https://bc.avancoinfo.com.br/", icone: "book-open" },
  { titulo: "GSF", busca: "gsurf parceiros", href: "https://parceiros.gsurfnet.com/login/login", icone: "gear" },
  { titulo: "Novo Avanço", busca: "novoavanco sistema", href: "https://novo.avancoinfo.com.br/", icone: "avanco" },
  { titulo: "Portal CTEF", busca: "portal sitef portal do cliente software express ctef", href: "https://portaldocliente.softwareexpress.com.br/Login", icone: "credit-card" },
  { titulo: "Quadro 2F", busca: "quadro kanban suporte equipe avancao", href: "https://www.avancao.com.br/equipes/cmrjc9j7w000e9rv4nbr862me", icone: "kanban" },
  { titulo: "SiteF", busca: "sitef admin software express", href: "https://sitefexpressadm.softwareexpress.com.br/sitefwebadm/pages/inicial.zeus", icone: "link" },
];

const EMAIL_SUPORTE = "rafael.rodrigues@avancoinfo.com.br";

export const AJUDA = [
  { titulo: "Como utilizar o FrontCore", href: "../ajuda/", icone: "help-circle" },
  { titulo: "Dúvidas frequentes (FAQ)", href: "../ajuda/#faq", icone: "help-circle" },
  {
    titulo: "Solicitar nova ferramenta",
    href: `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("FrontCore: solicitação de nova ferramenta")}`,
    icone: "gear",
  },
  {
    titulo: "Reportar problema",
    href: `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("FrontCore: problema encontrado")}`,
    icone: "alert",
  },
];

export const VANTAGENS = [
  { icone: "bolt", titulo: "Mais agilidade", texto: "Ferramentas centralizadas" },
  { icone: "shield", titulo: "Mais segurança", texto: "Processos padronizados" },
  { icone: "users", titulo: "Mais autonomia", texto: "Acesso de qualquer lugar" },
  { icone: "bars", titulo: "Mais eficiência", texto: "Suporte fortalecido" },
];
