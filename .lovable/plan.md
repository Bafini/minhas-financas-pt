

## Plano: Subcategorias na tabela + clique para filtrar gráfico

### Alterações em `src/pages/GroupPage.tsx`

**1. Novo estado `selectedSubcategory`**
Adicionar estado para filtrar por subcategoria, além da categoria já existente.

**2. Expandir tabela "Por Categoria" com subcategorias**
- Cada linha de categoria torna-se clicável (cursor pointer) e ao clicar filtra por essa categoria
- Abaixo de cada categoria, listar as suas subcategorias (indentadas) com os mesmos valores (total, prevTotal, variação, % do total)
- Subcategorias também clicáveis para filtrar o gráfico por subcategoria
- Linha ativa destacada com fundo colorido

**3. Filtro de transações atualizado**
- `filteredTx` e `filteredPrevTx` passam a considerar também `selectedSubcategory`
- Se `selectedSubcategory` estiver ativo, filtra por `subcategory_id`
- Se apenas `selectedCategory` estiver ativo, filtra por `category_id`
- Clicar na mesma categoria/subcategoria remove o filtro (toggle)

**4. Dados de subcategoria (`bySubcat`)**
- Novo `useMemo` que agrupa transações por subcategoria dentro de cada categoria
- Usado para renderizar as linhas de subcategoria na tabela

**5. Indicação visual**
- Categoria selecionada com fundo `bg-muted`
- Subcategoria selecionada com fundo `bg-muted/50`
- Botão "Limpar filtro" visível quando há filtro ativo na tabela

### Ficheiro a editar
- `src/pages/GroupPage.tsx` (ficheiro único)

