## Objetivo

Cada banco passa a ter a sua própria "data da última atualização". Ao importar um ficheiro, essa data é actualizada com o **último movimento importado desse banco**, em vez de uma única data global no perfil.

## Comportamento

- No ecrã "Importar Banco", a opção **"Última atualização"** mostra a data específica do banco selecionado (CGD, Revolut, Wizink, manual). Se o utilizador mudar o banco no dropdown, a data mostrada actualiza.
- Quando "Auto-detetar" estiver selecionado: enquanto o ficheiro não é analisado, mostra "—". Após análise (preview), passa a mostrar a data do banco detectado.
- Ao concluir uma importação, só é actualizada a data **do banco desse ficheiro** (não a global). Se a data mais recente importada for posterior à guardada para esse banco, sobrepõe.
- A data global existente (`profiles.movements_updated_until`) deixa de ser usada por este ecrã, mas mantém-se na BD para não quebrar nada que possa lê-la noutro lado.

## Alterações técnicas

### Base de dados (migration)

Nova tabela `bank_update_dates`:

- `id uuid pk`
- `user_id uuid not null`
- `bank_source text not null` (`cgd` | `revolut` | `wizink` | `manual`)
- `last_date date not null`
- `updated_at timestamptz default now()`
- UNIQUE (`user_id`, `bank_source`)
- RLS no mesmo padrão das outras tabelas (próprio utilizador + parceria com `get_partner_id` / `get_partner_permission` para INSERT/UPDATE/DELETE; SELECT também ao parceiro).

### Frontend (`src/components/integracoes/BankImportTab.tsx`)

- Substituir o estado `lastUpdatedDate: string | null` por `bankDates: Record<BankSource, string | null>` carregado uma vez em `useEffect` via `select('bank_source, last_date').eq('user_id', userId)`.
- Adicionar `currentBank` derivado: se `bank !== 'auto'` → `bank`; senão `previewBankSource` (quando já houve parse); caso contrário `null`.
- O label "Última atualização (DD/MM/AAAA)" usa `bankDates[currentBank]`. Se `currentBank` for `null`, mostra "(seleciona o banco)".
- `effectiveCutoff` passa a depender de `bankDates[currentBank]` em vez de `lastUpdatedDate`.
- No fim de `handleImport`, em vez de fazer `update` em `profiles.movements_updated_until`, fazer `upsert` em `bank_update_dates` com `{ user_id, bank_source: detectedBank, last_date: maxImportedDate }` (onConflict `user_id,bank_source`), só se `maxImportedDate` for posterior ao actual. Actualizar o estado local `bankDates`.
- Após `handleParse`, se `bank === 'auto'`, refrescar o label com `bankDates[parsed.bankSource]`.

### Sem alterações

- Parsers, regras de importação, dedup, lógica de inserção, painel "últimos 5 importados".
- `profiles.movements_updated_until` mantém-se na BD (não removido).