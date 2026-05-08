
## Comportamento ao associar linha do ficheiro a uma regra recorrente

### Regra
Quando o utilizador (ou a aprendizagem automática) associa uma linha do ficheiro a uma `recurring_rule`, o ficheiro é a fonte de verdade:

1. **Substitui** a transação auto-gerada (se existir) para o período correspondente
2. **Atualiza o valor** da regra recorrente para refletir o valor real do ficheiro
3. Mantém o vínculo `recurring_rule_id` na nova transação

### Fluxo no momento do "Importar" (em `BankImportTab.tsx`)

Para cada linha com `recurringRuleId` definido:

```text
1. Calcular período da recorrência (mês/ano da data do ficheiro)
2. Procurar transação existente em `transactions` com:
     - recurring_rule_id = X
     - auto_generated = true
     - data dentro do período (ex: mesmo mês/ano)
3. Se encontrada → DELETE essa transação (substituição)
4. INSERT nova transação com:
     - dados do ficheiro (date, amount, description em notes)
     - recurring_rule_id = X
     - is_recurring = true
     - auto_generated = false  (vem do extrato real)
     - bank_source, external_ref
     - category_id, subcategory_id, macro_group herdados da regra
5. Se valor do ficheiro ≠ valor atual da regra:
     - UPDATE recurring_rules SET amount = <valor ficheiro> WHERE id = X
     - Mostrar toast: "Valor da recorrência «Nome» atualizado: 45,00 € → 47,30 €"
```

### Indicação visual no preview

Antes do import, na linha do preview com recorrente associada:
- Badge **"Substitui auto-gerada"** se já existe transação automática para esse período
- Badge **"Valor difere: 45,00 → 47,30"** quando o valor do ficheiro diverge da regra (apenas informativo, será aplicado na importação)

### Edge case: múltiplas linhas para a mesma recorrência no mesmo período
Se o utilizador associar duas linhas à mesma regra no mesmo mês (ex: pagamento parcelado), apenas a primeira substitui a auto-gerada. As seguintes são inseridas normalmente com `recurring_rule_id` mas sem apagar mais nada. Não atualiza o valor da regra nestes casos (evita oscilação).

### Sem alterações de schema
Toda a lógica usa colunas já existentes:
- `transactions.auto_generated` (já existe)
- `transactions.recurring_rule_id` (já existe)
- `recurring_rules.amount` (já existe)

### Ficheiros a editar
- `src/components/integracoes/BankImportTab.tsx` — adicionar:
  - Lookup de transações auto-geradas existentes ao carregar preview (para mostrar badge "Substitui")
  - Lógica de substituição + update de `recurring_rules.amount` no handler de importação
  - Badges visuais "Substitui auto-gerada" e "Valor difere"
