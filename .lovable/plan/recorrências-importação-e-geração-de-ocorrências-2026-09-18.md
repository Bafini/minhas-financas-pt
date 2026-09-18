# Recorrências: importação e geração de ocorrências

Duas correções pedidas.

## 1. Recorrências desativadas não aparecem na importação

Hoje, no ecrã de importação de ficheiros do banco, a lista de recorrências mostra todas as regras, incluindo as que estão desligadas.

Alteração: a lista passa a mostrar apenas as recorrências ativas. Exceção: se uma linha já estiver associada a uma recorrência que entretanto foi desativada, essa continua visível nessa linha (marcada como inativa), para não se perder a associação existente.

## 2. "Gerar" cria todas as ocorrências no dia 1

Ao gerar ocorrências de uma recorrência, o dia usado é o da data de início, ignorando o "Dia do mês" escolhido no formulário. Como a data de início costuma ser o primeiro dia, tudo sai no dia 1.

Alteração: a geração passa a respeitar o dia configurado na recorrência.
- Mensal/trimestral/anual: usa o dia do mês indicado; se o mês não tiver esse dia (ex.: 31 em fevereiro), usa o último dia do mês.
- Semanal: usa o dia da semana indicado (1 = segunda ... 7 = domingo).
- Diária: mantém-se igual.
- A primeira ocorrência nunca é anterior à data de início e nenhuma ultrapassa a data de fim.
- Também se evita duplicar ocorrências já existentes para a mesma recorrência e data.

## Detalhes técnicos

- `src/components/integracoes/BankImportTab.tsx`: filtrar `recurrings` por `is_active` no seletor (mantendo a regra já selecionada na linha).
- `src/pages/RecorrenciasPage.tsx` (`generateOccurrences`): calcular as datas a partir de `day_of_period` em vez de avançar a partir de `start_date`; clamp ao último dia do mês; verificar transações existentes por `recurring_rule_id` + `date` antes de inserir.
