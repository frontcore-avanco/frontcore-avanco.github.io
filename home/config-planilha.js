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
  ranking: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9KoYI_TmKQjHBcQJB_FBVz3eEKNfOdB-G0IsocQ21nCTcvbqPVtL4Q-LjQk9M_j5bKmoffDodwVa0/pub?gid=1059556581&single=true&output=csv",
  okr: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9KoYI_TmKQjHBcQJB_FBVz3eEKNfOdB-G0IsocQ21nCTcvbqPVtL4Q-LjQk9M_j5bKmoffDodwVa0/pub?gid=1934408522&single=true&output=csv",
  agenda: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9KoYI_TmKQjHBcQJB_FBVz3eEKNfOdB-G0IsocQ21nCTcvbqPVtL4Q-LjQk9M_j5bKmoffDodwVa0/pub?gid=1285926742&single=true&output=csv",
  notificacoes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9KoYI_TmKQjHBcQJB_FBVz3eEKNfOdB-G0IsocQ21nCTcvbqPVtL4Q-LjQk9M_j5bKmoffDodwVa0/pub?gid=1518233172&single=true&output=csv",
};

// de quanto em quanto tempo a home relê a planilha (o Google também guarda
// uma cópia por alguns minutos, então atualizar a planilha leva um tempinho)
export const RELER_A_CADA_MIN = 10;
