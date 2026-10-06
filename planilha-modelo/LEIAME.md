# Planilha dos painéis do FrontCore

Os painéis **OKR**, **Ranking**, **Agenda da Equipe** e **Novos manuais incluídos**, além das notificações do sino, leem os dados de uma planilha do Google Sheets. Quem edita a planilha atualiza a tela inicial, sem precisar mexer no FrontCore.

## Montar a planilha (uma vez)

1. No Google Drive: **Novo → Upload de arquivo** e envie `modelo-planilha-frontcore.xlsx`. Depois abra o arquivo no Google Sheets, ou use **Arquivo → Importar** numa planilha nova.
2. Confira que as abas **OKR**, **Ranking**, **Agenda** e **Notificacoes** existem. Não mude os nomes das colunas (primeira linha).
3. Apague as linhas de exemplo e preencha as suas.

## Publicar cada aba como CSV (uma vez por aba)

Faça isso para as quatro abas de dados. **Não publique a aba LEIA-ME.**

1. **Arquivo → Compartilhar → Publicar na Web**.
2. Em "Link", escolha **a aba** (ex.: OKR) e, ao lado, **Valores separados por vírgula (.csv)**.
3. Clique em **Publicar** e copie o link gerado.
4. Mande os quatro links (OKR, Ranking, Agenda, Notificacoes) para quem mantém o FrontCore. Eles entram em `home/config-planilha.js`.

Depois disso, qualquer alteração na planilha aparece na tela inicial em alguns minutos (o Google guarda uma cópia por um tempo e a home relê a cada 10 minutos).

## Colunas de cada aba

| Aba | Colunas |
|---|---|
| **OKR** | `objetivo`, `resultado_chave`, `meta`, `atual`, `unidade`, `prazo`, `observacao` |
| **Ranking** | `periodo`, `operador`, `atendimentos`, `satisfacao`, `bugs_e_melhorias` |
| **Agenda** | `data` (dd/mm/aaaa), `hora`, `titulo`, `tipo`, `link` (opcional) |
| **Notificacoes** | `data` (dd/mm/aaaa), `tipo`, `titulo`, `link` |

- **OKR:** uma linha por resultado-chave; linhas com o mesmo `objetivo` ficam juntas. Se `meta` e `atual` forem números, aparece a barra de progresso (atual ÷ meta, verde a partir de 100%, amarelo a partir de 70%). Se forem texto (ex.: meta `4 a 4,5`), aparecem como texto. `atual` vazio mostra "Sem acompanhamento lançado".
- **Ranking:** o painel ordena sozinho e mostra o top 3 de atendimentos, de satisfação e de cards de bugs e melhorias. O `periodo` da primeira linha aparece no topo.
- **Agenda:** só aparecem compromissos de hoje em diante (até 6).
- **Notificacoes:** `tipo` pode ser `Manual novo`, `Manual atualizado`, `Ferramenta` ou `Base de Conhecimento`. O `link` leva direto ao conteúdo (um endereço `https://...` ou um caminho do próprio FrontCore, como `../manuais/`). Notificações dos últimos 14 dias contam como novas no sino.

## Cuidados

- O link publicado pode ser lido por **qualquer pessoa que o conheça**. Não coloque na planilha nada que não possa ser visto por terceiros.
- Só a pessoa que edita a planilha deve ter acesso de edição; a equipe só vê o resultado na tela inicial.
- Enquanto a planilha não estiver conectada, o painel de OKR mostra os OKRs iniciais e os demais mostram "será alimentado pela planilha".
