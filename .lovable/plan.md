# Normalizar formato de data em toda a app

Hoje o formato escolhido em Definições (`profiles.date_format`) só é usado na página Integrações (import/export CSV). Todos os outros ecrãs chamam `formatDate(...)` sem formato, ficando fixos em DD/MM/AAAA.

## O que muda

1. **Preferência global de data**
   - Novo contexto `DateFormatProvider` que lê `profiles.date_format` do perfil ativo (respeitando parcerias) e o expõe via hook `useDateFormat()`, com helpers `fd(date)` (data completa) e `fdShort(date)`.
   - Fica disponível em toda a app (montado em `App.tsx`, junto dos restantes providers).
   - Ao mudar o formato em Definições, o contexto atualiza e todos os ecrãs refletem a alteração sem recarregar.

2. **Ecrãs atualizados para usar a preferência**
   - Movimentos (tabela e filtros), Eventos, Cartões, Recorrências, Orçamentos, Comparações, Logs, Dashboard/PeriodFilter, diálogos Adicionar Vários e Duplicar.
   - Integrações: importação/exportação passam a usar o contexto em vez do fetch local duplicado.

3. **Importação bancária (BankImportTab)**
   - Todas as datas mostradas (linhas do ficheiro, últimos 5 importados, data de última atualização, possíveis duplicados) passam a respeitar o formato das preferências — hoje estão fixas em `'DD/MM/YYYY'`.
   - As linhas do ficheiro passam a ser apresentadas **por data descendente** (mais recente primeiro); em empate, mantém-se a ordem original do ficheiro.
   - A ordenação é só de apresentação: a importação, deteção de duplicados e regras continuam iguais.

## Notas técnicas

- Campos de introdução (`<input type="date">`) continuam em ISO/nativo do browser — o formato da preferência aplica-se à leitura, não ao widget nativo.
- `formatDate`/`formatDateShort` mantêm a assinatura atual; o contexto apenas injeta o formato por omissão.
- Ordenação no preview feita sobre a lista `rows` com um índice estável para desempate, sem alterar `rowId` nem a lógica de import.
