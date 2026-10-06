// -----------------------------------------------------------------------
// okr-inicial.js — OKRs usados enquanto a planilha não está conectada.
// Mesmo formato da aba "OKR" da planilha (planilha-modelo/). Quando o link
// da planilha entra em config-planilha.js, estes dados deixam de ser usados.
// "atual" vazio = ainda sem acompanhamento lançado (não inventamos número).
// -----------------------------------------------------------------------
export const OKR_INICIAL = [
  { objetivo: "OKRs de Atendimento", resultado_chave: "Tempo de resolução: 80% dos atendimentos concluídos em até 3 horas", meta: "80", atual: "", unidade: "%", prazo: "", observacao: "" },
  { objetivo: "OKRs de Atendimento", resultado_chave: "Tempo de espera: 80% dos clientes atendidos em até 30 minutos", meta: "80", atual: "", unidade: "%", prazo: "", observacao: "" },
  { objetivo: "OKRs de Atendimento", resultado_chave: "Satisfação: manter a média entre 4 e 4,5 estrelas", meta: "4 a 4,5", atual: "", unidade: "estrelas", prazo: "", observacao: "" },
  { objetivo: "Migração do Tramitador", resultado_chave: "Base de clientes migrada para o novo Tramitador", meta: "90", atual: "70", unidade: "%", prazo: "Final do ano", observacao: "108 clientes restantes" },
  { objetivo: "FrontCore e Padronização", resultado_chave: "Implementar e utilizar as ferramentas desenvolvidas no FrontCore", meta: "", atual: "", unidade: "", prazo: "", observacao: "" },
  { objetivo: "FrontCore e Padronização", resultado_chave: "Criar manuais padronizados: configuração de caixa, tratativas de pequenos erros, configuração CTEF e novos procedimentos", meta: "", atual: "", unidade: "", prazo: "", observacao: "" },
  { objetivo: "FrontCore e Padronização", resultado_chave: "Centralizar a Base de Conhecimento no FrontCore", meta: "", atual: "", unidade: "", prazo: "", observacao: "" },
];
