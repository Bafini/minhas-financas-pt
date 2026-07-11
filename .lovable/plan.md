## Problema

A checkbox "importar mesmo assim" foi adicionada mas o utilizador não a consegue ver em nenhum cenário. Há duas causas prováveis:

1. **Tamanho invisível**: A Checkbox está com `className="h-3 w-3"`, mas o componente shadcn tem `h-4 w-4` fixo no interno e um `<Check>` com tamanho próprio — pode renderizar praticamente invisível ou colapsado dentro do `label` com `text-[10px]`.
2. **Casos em falta**: Só aparece quando `isDuplicate || isExisting` (duplicado exato). No fluxo típico do utilizador (dois movimentos iguais no ficheiro que ele quer manter, ou match fuzzy contra a BD marcado como "possível duplicado"), a checkbox não existe de todo.

## Alterações

**`src/components/integracoes/BankImportTab.tsx`**

### 1. Tornar a checkbox visível (duplicados exatos)

Substituir a checkbox `h-3 w-3` por um **botão toggle inline** mais óbvio ao lado do badge, com estado claro:

```
[duplicado] [ importar mesmo assim ]   ← estado normal
[duplicado — forçado] [ ✓ a importar ]  ← quando ativado
```

Usar `<Button size="sm" variant="outline"/"secondary" className="h-5 text-[10px] px-2">` em vez de checkbox+label. Fica visualmente igual às outras ações inline (ex: "Usar ficheiro / Manter recorrente") e é impossível não ver.

### 2. Adicionar o mesmo botão ao popover de "possível duplicado"

No popover (linhas ~736-739), acrescentar uma terceira ação:

```
[ É o mesmo — ignorar ]  [ São diferentes ]  [ Importar mesmo assim ]
```

O "Importar mesmo assim" define `forceImport = true` + `possibleDuplicateDismissed = true`. O badge do popover passa a mostrar "possível duplicado — forçado" quando ativo.

### 3. Contadores

Ajustar `counts.possibleDuplicates` e `counts.importable` para tratar `forceImport` também para linhas com `possibleDuplicateOf` (hoje só considera `isDuplicate || isExisting`). A lógica em `handleImport` já não filtra por `possibleDuplicateOf`, portanto essas linhas já eram importáveis — a mudança é apenas cosmética no contador do topo.

### 4. Verificação

Após o build, abrir a página de integrações via Playwright, simular um import com um ficheiro que tenha duas linhas idênticas e confirmar que o botão "importar mesmo assim" está visível e clicável na linha marcada como duplicada.

## Fora de âmbito

- Nenhuma mudança em parsers, migrations ou detecção de duplicados.
- Nenhuma mudança na lógica de inserção — continua a permitir múltiplos movimentos com mesma data/valor quando forçados.