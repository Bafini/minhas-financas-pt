

## Plano: Página de Eventos baseada na tabela `event_labels`

### Problema atual
A página constrói a lista de eventos a partir da coluna `event_label` das transações e depois cruza com `event_labels`. Isto significa que eventos que existem apenas como notas (sem registo em `event_labels`) aparecem como eventos, e a fonte de verdade está dispersa.

### Alterações

**1. Migração de dados (SQL via insert tool)**

Copiar `notes` → `event_label` e criar registos em `event_labels` para valores únicos:

```sql
-- Copiar notes para event_label onde ainda não tem evento
UPDATE transactions 
SET event_label = notes 
WHERE event_label IS NULL AND notes IS NOT NULL AND notes != '';

-- Criar event_labels para valores distintos que não existam
INSERT INTO event_labels (user_id, name, is_active)
SELECT DISTINCT t.user_id, t.event_label, true
FROM transactions t
WHERE t.event_label IS NOT NULL AND t.event_label != ''
  AND NOT EXISTS (
    SELECT 1 FROM event_labels el 
    WHERE el.user_id = t.user_id AND el.name = t.event_label
  );
```

**2. Refactoring da `EventosPage.tsx`**

- A lista principal passa a ser a tabela `event_labels` (fonte de verdade)
- Para cada evento, agregar totais/contagem das transações com `event_label = nome`
- Remover a lógica separada de `labelsWithoutTxs` (tudo vem da mesma lista)
- Manter sugestões baseadas em `notes` para transações que ainda não têm `event_label`
- Remover coluna "Notas" do detalhe do evento (já não é relevante)

**3. Remover coluna Notas da tabela de Movimentos (`MovimentosPage.tsx`)**

- Remover a coluna "Notas" da listagem, manter apenas "Evento" que mostra `event_label`

### Ficheiros a editar
1. **SQL via insert tool** — migração de dados
2. **`src/pages/EventosPage.tsx`** — refactoring para usar `event_labels` como base
3. **`src/pages/MovimentosPage.tsx`** — remover coluna Notas

