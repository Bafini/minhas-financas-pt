

## Plano: Propagar data para linhas seguintes no BulkAddDialog

### Alterações em `src/components/movimentos/BulkAddDialog.tsx`

**1. `updateLine`** — quando o campo alterado for `date`, propagar a nova data para todas as linhas com índice superior:

```typescript
const updateLine = (idx: number, updates: Partial<BulkLine>) => {
  setLines(prev => prev.map((l, i) => {
    if (i < idx) return l;
    if (i === idx) {
      const updated = { ...l, ...updates };
      if ('macroGroup' in updates) { updated.categoryId = ''; updated.subcategoryId = ''; }
      if ('categoryId' in updates) { updated.subcategoryId = ''; }
      return updated;
    }
    // i > idx: propagar data
    if ('date' in updates) return { ...l, date: updates.date! };
    return l;
  }));
};
```

**2. `addLine`** — já herda grupo/categoria/evento da última linha; adicionar também a **data**:

```typescript
const addLine = () => {
  const last = lines[lines.length - 1] || emptyLine();
  setLines(prev => [...prev, {
    ...emptyLine(),
    date: last.date,
    macroGroup: last.macroGroup,
    categoryId: last.categoryId,
    subcategoryId: last.subcategoryId,
    eventLabel: last.eventLabel,
  }]);
};
```

Ficheiro único a editar: `src/components/movimentos/BulkAddDialog.tsx` (2 alterações pontuais).

