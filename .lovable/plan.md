

## Correção: Data não propaga no BulkAddDialog

### Problema
A função `addLine` lê `lines[lines.length - 1]` fora do `setLines` updater, o que pode capturar um valor desatualizado (stale closure). Quando o React ainda não fez re-render após a última alteração de data, `lines` tem o valor antigo.

### Solução em `src/components/movimentos/BulkAddDialog.tsx`

Mover a leitura do último registo para dentro do functional updater:

```typescript
const addLine = () => {
  setLines(prev => {
    const last = prev[prev.length - 1] || emptyLine();
    return [...prev, {
      ...emptyLine(),
      date: last.date,
      macroGroup: last.macroGroup,
      categoryId: last.categoryId,
      subcategoryId: last.subcategoryId,
      eventLabel: last.eventLabel,
    }];
  });
};
```

Ficheiro único, alteração de ~4 linhas.

