## Problema

Quando o parser deteta um "duplicado" — seja duplicado dentro do próprio ficheiro (`isDuplicate`, mesmo dia+valor+banco+referência) ou já existente na BD (`isExisting`) — a linha fica sombreada e é excluída da importação sem forma de contestar. Isto falha nos casos legítimos em que existem mesmo dois movimentos iguais no mesmo dia (ex: dois cafés de 1,60 €, dois levantamentos de 20 €).

Nota: para "possível duplicado" (mesmo valor ±3 dias, banco/ref diferente) já existe o botão "São diferentes" no popover. Este plano trata dos casos duros marcados como `duplicado` firme.

## Alteração

Em `src/components/integracoes/BankImportTab.tsx`:

1. Novo campo em `PreviewRow`: `forceImport: boolean` (default `false`).
2. Nas linhas com `isDuplicate || isExisting`, mostrar ao lado do badge "duplicado" um pequeno botão/checkbox **"Importar mesmo assim"**. Ao ativar, define `forceImport = true`. O sombreado passa a mais ténue e o badge muda para "duplicado — forçado".
3. `handleImport`: alterar o filtro de `toImport` para incluir linhas com `forceImport` mesmo que sejam duplicados:
   ```
   rows.filter(r => !r.ignore && !isBeforeCutoff(r.date) && (r.forceImport || (!r.isDuplicate && !r.isExisting)))
   ```
4. Ajustar `counts.importable`, `counts.duplicates` (contar `isDuplicate||isExisting` que NÃO estão em `forceImport`) para que o botão "Importar N movimentos" e as contagens no topo reflitam a decisão do utilizador.
5. Para o caso `isExisting` forçado, a inserção segue o fluxo normal — a BD aceita, pois não há unique constraint em (date, amount, external_ref); fica um segundo movimento efetivo.

Sem mudanças em parsers, migrations ou lógica de regras.
