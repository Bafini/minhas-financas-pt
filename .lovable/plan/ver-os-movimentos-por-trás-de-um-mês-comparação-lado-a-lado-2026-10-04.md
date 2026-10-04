# Ver os movimentos por trás de um mês (comparação lado a lado)

## O que muda para si
- Nas páginas de Grupos (Rendimentos, Despesas, Investimentos) e em Comparações, clicar numa barra ou ponto de um mês abre uma página nova: **Detalhe do Mês**.
- A página mostra uma coluna por ano (ex.: Setembro 2025 | Setembro 2026), cada uma com:
  - Total do mês e diferença entre anos (valor e %).
  - Resumo por categoria/subcategoria, lado a lado, com a diferença destacada — mostra logo o que explica a variação (ex.: "Salário: 2.400 € vs 1.900 €").
  - Lista dos movimentos (data, descrição, categoria, subcategoria, valor), por ordem de data.
- Clicar numa categoria do resumo filtra as listas de movimentos dos dois anos.
- Os filtros já aplicados (grupo, categoria, modo YTD) passam para a página de detalhe.
- Botão "Voltar" regressa à página de origem; seletores no topo permitem mudar mês e anos sem voltar atrás.
- Respeita o formato de data das preferências e o modo de privacidade.

## Exemplo
Em Rendimentos, clicar em "Set" no gráfico mensal -> abre Setembro 2026 vs 2025, onde vê que em 2025 houve um movimento extra (ex.: subsídio ou reembolso) que não se repetiu.

## Detalhes técnicos
- Nova rota `/detalhe-mes?month=9&years=2026,2025&group=Rendimentos&category=...&ytd=0` em App.tsx (página `MonthDetailPage.tsx`).
- `onClick` nos BarChart/LineChart de GroupPage.tsx e ComparacoesPage.tsx (usa `activeLabel`/`activeTooltipIndex` para obter o mês) -> `navigate` com os parâmetros atuais; cursor pointer.
- Dados: `fetchAllRows` de transactions do `activeUserId` por intervalo de datas de cada ano, com os mesmos filtros (`is_duplicate=false`, `exclude_from_kpis=false`), join a categories/subcategories.
- Tabela de diferenças por categoria/subcategoria ordenada pela maior diferença absoluta; reutiliza `calculateDelta`, `formatCurrency`, `useDateFormat`, classe `financial-value`.
- Layout em duas colunas (empilha em ecrã pequeno), estilo glass-surface existente.
