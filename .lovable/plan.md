

## Plano: Página de Logs (Auditoria)

### Objetivo
Criar uma página "Logs" na secção Gestão que registe automaticamente acessos e alterações (criação, edição, eliminação de movimentos — manuais e automáticos), permitindo ao utilizador reverter ou apagar registos.

### 1. Nova tabela `audit_logs`

Migração SQL:

```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,          -- 'login', 'insert', 'update', 'delete'
  entity_type text NOT NULL,     -- 'session', 'transaction', 'category', etc.
  entity_id uuid,                -- ID do registo afetado (null para logins)
  old_data jsonb,                -- dados anteriores (para update/delete)
  new_data jsonb,                -- dados novos (para insert/update)
  source text DEFAULT 'manual',  -- 'manual', 'import', 'recurring', 'telegram', 'bulk'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id = get_partner_id(auth.uid()));

CREATE POLICY "Users can insert own audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));

CREATE POLICY "Users can delete own audit_logs" ON public.audit_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);
```

### 2. Registar logs automaticamente

Nos pontos onde já se fazem operações na tabela `transactions`, adicionar chamadas de inserção em `audit_logs`:

- **`MovimentosPage.tsx`** — em `handleSave` (insert/update), `handleDelete`, `handleInlineSave`, `handleDuplicateSubmit`, `handleBulkSubmit`
- **`AuthContext.tsx`** — registar log de acesso (`action: 'login'`) após login bem-sucedido
- **Edge functions** (`generate-recurring`, `telegram-poll`) — registar logs de movimentos auto-gerados com `source: 'recurring'` / `source: 'telegram'`

Criar helper em `src/lib/auditLogger.ts`:
```typescript
export async function logAudit(params: {
  userId: string;
  action: 'login' | 'insert' | 'update' | 'delete';
  entityType: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  source?: string;
}) { ... }
```

### 3. Nova página `LogsPage.tsx`

- Tabela com colunas: Data/Hora, Ação (badge colorido), Tipo, Descrição, Origem
- Filtros: por tipo de ação, por período, por entidade
- Paginação (50 por página)
- Botão **"Reverter"** em linhas de tipo `insert`/`update`/`delete` de transações:
  - Insert → apaga a transação criada
  - Update → restaura `old_data`
  - Delete → re-insere a transação a partir de `old_data`
- Botão **"Apagar log"** para limpar entradas individuais

### 4. Navegação

- Adicionar entrada "Logs" no `manageNav` do `AppSidebar.tsx` (ícone `ScrollText`)
- Adicionar rota `/logs` no `App.tsx`

### Ficheiros a criar/editar
1. **SQL** — migração para `audit_logs`
2. **`src/lib/auditLogger.ts`** — helper de inserção de logs
3. **`src/pages/LogsPage.tsx`** — nova página
4. **`src/pages/MovimentosPage.tsx`** — adicionar chamadas ao logger
5. **`src/contexts/AuthContext.tsx`** — log de login
6. **`src/components/layout/AppSidebar.tsx`** — nova entrada no menu
7. **`src/App.tsx`** — nova rota
8. **Edge functions** — adicionar logs (opcional, pode ser fase 2)

