// -----------------------------------------------------------------------
// config-planilha.js — de onde vêm os dados dos painéis (Ranking, OKR,
// Agenda e Notificações).
//
// Cada painel lê uma aba de uma planilha do Google Sheets "publicada na
// web" em formato CSV. Pra conectar: no Google Sheets, Arquivo → Compartilhar
// → Publicar na Web → escolha UMA aba e o formato "Valores separados por
// vírgula (.csv)" → Publicar → cole o link aqui embaixo, entre as aspas.
// Passo a passo completo em planilha-modelo/LEIAME.md.
//
// Link vazio = painel usa os dados iniciais (OKR) ou mostra "sem dados".
// ATENÇÃO: o link publicado é legível por quem o conhecer, e este arquivo
// fica num repositório público — não coloque na planilha nada que não possa
// ser visto por terceiros.
// -----------------------------------------------------------------------
export const PLANILHA = {
  ranking: "",
  okr: "",
  agenda: "",
  notificacoes: "",
};

// de quanto em quanto tempo a home relê a planilha (o Google também guarda
// uma cópia por alguns minutos, então atualizar a planilha leva um tempinho)
export const RELER_A_CADA_MIN = 10;
