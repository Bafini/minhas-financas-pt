
## Importação de extratos bancários (CGD, Revolut, Wizink) com aprendizagem

### 1. Base de dados (migration)

**Nova tabela `import_rules`** — regras editáveis (categorização e exclusão):
- `user_id`, `bank_source` (cgd|revolut|wizink|all), `rule_type` (categorize|ignore)
- `match_field` (description|description+sign|description+amount), `match_pattern` (texto normalizado)
- `category_id`, `subcategory_id` (nulos se ignore)
- `priority` (int), `auto_learned` (bool), `hit_count`, `last_used_at`

**Alterações em `transactions`**:
- Adicionar `bank_source TEXT` (cgd|revolut|wizink|manual)
- Adicionar `external_ref TEXT` (descrição original do banco, para matching)

**Alterações em `imports`**:
- Adicionar `bank_source TEXT`

Detecção de duplicados passa a usar `date + amount + bank_source + external_ref`.

### 2. Parsers (novo `src/lib/bankParsers/`)

- `cgd.ts` — CSV `;`, encoding latin1, salta cabeçalho até linha "Data mov.", parse débito/crédito, data DD-MM-YYYY
- `revolut.ts` — CSV `,`, ignora State≠COMPLETED, usa Started Date, Amount já tem sinal
- `wizink.ts` — esqueleto de PDF parser (placeholder com TODO; UI já preparada)
- `index.ts` — interface comum `ParsedBankRow { date, amount, description, rawType, bankSource }` + auto-detect por cabeçalho

### 3. Motor de regras (`src/lib/importRules.ts`)

- `normalizeDescription(s)` — lowercase, remove dígitos isolados, datas, espaços extra, acentos
- `matchRule(row, rules)` — devolve a regra de maior prioridade que casa
- `applyRules(rows, rules)` — para cada linha, marca `suggestedCategory` ou `shouldIgnore`
- `learnRule(row, categoryId, subcategoryId)` — cria/atualiza regra `auto_learned=true` com pattern normalizado

### 4. UI — refactor `IntegracoesPage.tsx`

**Tab "Importar"**:
1. Seletor de banco (CGD / Revolut / Wizink / Auto-detect)
2. Upload (CSV ou PDF conforme banco)
3. **Preview table** com colunas: Data | Descrição | Valor | Categoria sugerida (editável via combobox cat/subcat) | Ignorar (checkbox) | Estado
   - Linhas com regra aplicada destacadas (badge "Regra" ou "Auto-aprendido")
   - Botão "Criar regra de exclusão" no menu da linha (abre dialog com pattern editável)
   - Botão "Aplicar a todos iguais" quando categorizas uma linha
4. Resumo: X categorizadas automaticamente, Y por categorizar, Z ignoradas, W duplicadas
5. Ao confirmar: insere transações + cria regras `auto_learned` para todas as escolhas manuais que ainda não tinham regra

**Nova tab "Regras de Importação"**:
- Lista de regras com filtros (banco, tipo categorize/ignore)
- Editar pattern, prioridade, categoria, ativar/desativar, apagar
- Coluna `hit_count` e `last_used_at` para ver utilidade

### 5. Ficheiros a criar/editar

**Criar**:
- `supabase/migrations/...sql` (tabela + colunas + RLS espelhando padrão existente)
- `src/lib/bankParsers/{index,cgd,revolut,wizink}.ts`
- `src/lib/importRules.ts`
- `src/components/integracoes/BankImportTab.tsx` (substitui ImportTab atual)
- `src/components/integracoes/ImportRulesTab.tsx`
- `src/components/integracoes/RuleEditDialog.tsx`

**Editar**:
- `src/pages/IntegracoesPage.tsx` (nova tab "Regras", usa novo BankImportTab)
- `src/lib/queries.ts` (fetchImportRules)

### 6. Notas técnicas

- PDF Wizink: instalar `pdfjs-dist` mas deixar parser com TODO + mensagem "Em breve" na UI para não bloquear release
- Aprendizagem é incremental: regras manuais sobrepõem-se às auto-aprendidas (priority maior)
- Duplicados continuam toggleáveis mas o key usa `bank_source + external_ref` quando disponível
- Compatibilidade: importações antigas (formato genérico data,categoria,subcat,valor,notas) ficam disponíveis como banco "Manual"

### Fora deste plano
- Parser real do PDF Wizink (esperar amostra)
- Sugestão por ML (usamos só matching determinístico)
