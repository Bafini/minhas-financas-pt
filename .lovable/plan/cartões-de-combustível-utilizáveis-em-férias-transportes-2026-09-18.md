# Cartões de combustível utilizáveis em Férias › Transportes

## Objetivo
Permitir que os cartões de combustível possam ser usados em movimentos da subcategoria **Férias › Transportes**, com associação manual por cartão.

## Estado atual (verificado)
- O formulário de cartões (página Cartões) já tem a lista "Subcategorias de Despesa Associadas" com checkboxes para **todas** as subcategorias de Despesas — incluindo Férias › Transportes.
- Não existe qualquer restrição por tipo de cartão no código; cartões de combustível podem ser associados a qualquer subcategoria de despesa.
- Na página Movimentos, o seletor de cartão aparece automaticamente quando a subcategoria escolhida tem cartões associados (`hasCardsForSubcategory`), e o rendimento automático é recalculado ao guardar.

## Trabalho a fazer
1. **Verificar no ecrã** que "Férias › Transportes" aparece na lista de checkboxes do formulário de cartão (novo e editar).
2. **Pequeno melhoramento de usabilidade** (se necessário após a verificação):
   - Ordenar a lista de subcategorias por categoria para facilitar encontrar Férias › Transportes.
3. **Teste end-to-end** na app:
   - Editar um cartão existente, marcar "Férias › Transportes" e guardar.
   - Criar um movimento em Despesas › Férias › Transportes e confirmar que o seletor de cartão aparece e o cartão pode ser escolhido.
   - Confirmar que o rendimento automático do cartão é gerado/atualizado.

## Notas técnicas
- A associação grava na tabela `card_expense_subcategories` (já existente) — sem alterações de base de dados.
- A lógica de disponibilidade do cartão está em `src/lib/fuelCardHelpers.ts` (`getCardsForSubcategory` / `hasCardsForSubcategory`) e não distingue tipo de cartão.
- Ficheiros envolvidos: `src/pages/CartoesPage.tsx` (formulário), `src/pages/MovimentosPage.tsx` (seletor de cartão no movimento).
