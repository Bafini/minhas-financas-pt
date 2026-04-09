

## Plano: Corrigir botão › invisível no BulkAddDialog

### Problema
A coluna de data tem `160px` de largura, mas o input `type="date"` nativo ocupa demasiado espaço horizontal, empurrando o botão `›` (ChevronRight) para fora da área visível.

### Solução em `src/components/movimentos/BulkAddDialog.tsx`

1. Aumentar a largura da coluna de data de `160px` para `190px` no grid (tanto no header como nas linhas)
2. Adicionar `min-w-0` ao `<Input type="date">` para que o flexbox possa encolhê-lo
3. Garantir `overflow-hidden` no container flex da data

Alterações na grid: `grid-cols-[190px_110px_1fr_1fr_100px_130px_32px]` (2 locais: header e linhas).

