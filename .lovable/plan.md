## Melhorias na Importação Bancária

### 1. Filtro de data inicial das linhas a importar

No passo de **preview** do `BankImportTab.tsx`, adicionar um controlo de data com duas opções:

- **A partir da última atualização** (default) — usa `profiles.movements_updated_until` do perfil ativo (+1 dia). Se for `null`, comporta-se como "todas".
- **A partir de data específica** — DatePicker (DD/MM/AAAA) que o utilizador escolhe.
- **Todas as linhas** — sem filtro.

Linhas com `parsedDate < dataCorte` ficam visíveis na tabela mas com badge **"Antes do corte"** e marcadas como `skipped` (não contam para `validCount`, não são importadas). Resumo no topo passa a mostrar `X ignoradas por data`.

Após import bem-sucedido, atualiza `profiles.movements_updated_until` para a maior data importada (se for posterior à atual).

```text
[Cortar a partir de:]  ( ) Última atualização (15/04/2026)
                       (•) Data específica  [01/05/2026 ▼]
                       ( ) Importar todas
```

### 2. Escolha do valor quando diverge da recorrente

Quando uma linha está associada a uma `recurring_rule` e `Math.abs(file - rule) > 0.005`:

- Substituir o badge informativo atual por um pequeno **toggle por linha** com duas opções:
  - **Usar valor do ficheiro** (default) → comportamento atual: insere com valor do ficheiro e atualiza `recurring_rules.amount`.
  - **Manter valor da recorrente** → insere a transação com o valor da regra (não do ficheiro), substitui a auto-gerada, **não** atualiza `recurring_rules.amount`. A diferença (file − rule) fica registada nas `notes` da transação como `"Diferença vs ficheiro: +2,30 €"` para rastreabilidade (caso típico: parte em dinheiro + parte por transferência).

```text
Linha: NETFLIX 12,99 €  → recorrente "Netflix" (esperado 15,99 €)
   Valor difere: 12,99 → 15,99
   ( ) Usar 12,99 (ficheiro) e atualizar recorrente
   (•) Manter 15,99 (recorrente)  [diferença ficará nas notas]
```

A escolha por linha sobrepõe-se ao default. Adicionar também um **toggle global** no topo do preview ("Quando valor diverge da recorrente: usar ficheiro / manter recorrente") que define o default para todas as linhas divergentes.

### Detalhes técnicos

**Ficheiro a editar:** `src/components/integracoes/BankImportTab.tsx`

Novos campos em `PreviewRow`:
- `skippedByDate: boolean`
- `divergenceResolution: 'file' | 'rule' | null` (null quando não diverge)

Novo estado no componente:
- `cutoffMode: 'last' | 'custom' | 'all'`
- `customCutoffDate: Date | null`
- `lastUpdatedDate: string | null` (carregado de `profiles.movements_updated_until` no mount)
- `defaultDivergenceResolution: 'file' | 'rule'`

Lógica de `handleImport`:
- Filtra `toImport` excluindo `skippedByDate`.
- Para cada linha com `recurringRuleId` e divergência:
  - Se `resolution === 'file'`: insere com `row.amount`, **update** `recurring_rules.amount` (já implementado).
  - Se `resolution === 'rule'`: insere com `row.recurringExpectedAmount`, append à coluna `notes` o texto `"Diferença vs ficheiro: ±X,XX €"`, **NÃO** atualiza a regra. Substituição da auto-gerada mantém-se.
- Após o loop, calcula `maxImportedDate` e faz `update profiles.movements_updated_until` se aplicável.

Sem alterações de schema — usa colunas existentes (`profiles.movements_updated_until`, `transactions.notes`, `transactions.amount`, `recurring_rules.amount`).
