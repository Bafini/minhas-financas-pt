# Diagrama Sankey de fluxo financeiro

Sim, dá para fazer. O `recharts` já instalado (2.15.4) inclui o componente `Sankey`, por isso não é preciso nenhuma biblioteca nova.

## O que vai ser construído

Um novo cartão no **Dashboard**, por baixo do gráfico "Evolução Mensal", chamado **Fluxo Financeiro**, que mostra para onde vai o dinheiro no período selecionado (respeita o filtro de período já existente).

Estrutura do fluxo:

```text
Categoria Rend. A ─┐                 ┌─ Despesas ─┬─ Categoria Desp. 1
Categoria Rend. B ─┼─ Rendimentos ───┼─ Investim. ─┼─ Categoria Inv. 1
Categoria Rend. C ─┘                 └─ Poupança (saldo, se positivo)
```

- Lado esquerdo: categorias de Rendimentos (top 8, resto agrupado em "Outros").
- Nó central: Rendimentos totais.
- Lado direito: Despesas, Investimentos e Poupança; cada um ramifica nas suas categorias principais (top 8 + "Outros").
- Cores por grupo usando os tokens semânticos existentes (`--income`, `--expense`, `--investment`).

## Interação

- Alternador no cabeçalho do cartão entre **Categorias** e **Subcategorias** (nível de detalhe do 3.º nível).
- Tooltip com nome do fluxo, valor em EUR e peso percentual sobre os rendimentos.
- Estado vazio quando não há dados no período.
- Respeita o Modo Privacidade (valores dentro de `.financial-value` / wrapper recharts ficam desfocados).

## Detalhes técnicos

- Novo componente `src/components/finance/SankeyFlowChart.tsx` com props `transactions` (já carregadas no Dashboard) e `detail: 'category' | 'subcategory'`.
- Novo helper em `src/lib/calculations.ts`: `buildSankeyData(transactions, categoriesMap, detail)` que devolve `{ nodes, links }`, ignora transações com `exclude_from_kpis`, agrega por categoria/subcategoria e faz o corte top-N + "Outros".
- O Dashboard passa a carregar também o mapa de categorias/subcategorias (via `fetchCategories`) para resolver nomes.
- Nós com valor zero são omitidos para evitar links inválidos no Sankey.
- Renderização com `ResponsiveContainer` + `Sankey` do recharts, com `node` e `link` customizados para aplicar as cores dos tokens.

## Fora de âmbito

Não altera KPIs, nem as páginas de Grupos, nem a lógica de dados existente.
