## Melhorias na Importação Bancária — Valor Exacto + Detecção de Duplicados

### 1. Tornar "valor exacto" sempre acessível na importação

**Problema:** O checkbox "valor exacto" só aparece nas linhas em que há categoria **e** ainda não existe regra aprendida (`row.categoryId && !row.matchedRuleId`). Quando uma linha já é categorizada automaticamente por uma regra anterior, o checkbox desaparece — pelo que nunca se consegue converter as regras existentes em "valor exacto".

**Solução em `BankImportTab.tsx`:**

- Mostrar o checkbox "valor exacto" sempre que houver `categoryId` (remover a condição `!row.matchedRuleId`).
- Quando a linha já tem `matchedRuleId` e o utilizador altera o checkbox:
  - Se passa para `true`: cria/atualiza uma regra `description+amount` específica para este valor (priority 150). A regra antiga genérica não é apagada — passa a ser fallback para outros valores.
  - Se passa para `false`: nada na altura da importação (só voltará a aprender como genérica se o utilizador quiser).
- Alargar a inicialização: `matchExactAmount` inicial passa a ser `match.rule.match_field === 'description+amount'` (já está) — garantir que reflecte a regra activa.
- Adicionar tooltip claro: "Esta regra só aplica quando o valor é exactamente X €. Útil para distinguir vários movimentos com a mesma descrição (ex: 4 seguros diferentes na mesma categoria)."

### 2. Tornar visível e editável o "valor exacto" na lista de regras

**Solução em `ImportRulesTab.tsx`:**

- Adicionar coluna **"Match"** entre "Padrão" e "Categoria" com badge:
  - `descrição` — match só por descrição
  - `descrição + sinal` — quando `description+sign`
  - `desc + valor X €` — quando `description+amount` (mostra o valor extraído do pattern `desc|=12.99`)
- Tornar o pattern mostrado mais legível: separar `desc` de `|=valor` para não parecer ruído.
- Adicionar botão de acção rápida na linha (ícone) para alternar entre "match por descrição" ↔ "match por descrição + valor exacto" sem ter de apagar e recriar:
  - Atualiza `match_field`, `match_pattern` (adiciona/remove sufixo `|=X.XX`), `priority` (100 ↔ 150).
  - Quando se converte para "valor exacto", precisa de saber qual o valor — mostra mini-dialog a perguntar.

### 3. Detecção de duplicados por data+valor no preview

**Problema actual:** A detecção de duplicados é estrita: `date|amount|bank_source|external_ref`. Se o mesmo movimento for importado de outro banco (ex: já registado manualmente, ou por outro extrato), passa despercebido.

**Solução em `BankImportTab.tsx`:**

- Carregar as transacções existentes já no parse (`handleParse`) com janela alargada — em vez de apenas `external_ref` exacto, comparar também por `date + amount` aproximado (mesma data e mesmo valor independentemente de banco/ref).
- Adicionar novo campo a `PreviewRow`: `possibleDuplicateOf: { id: string; date: string; amount: number; notes: string | null; category: string | null } | null`.
- Lógica de detecção em duas camadas:
  1. **Duplicado certo** (já existente): match estrito em `date|amount|bank_source|external_ref` → marca `isExisting=true` (comportamento actual; bloqueia import por defeito).
  2. **Possível duplicado** (sugestão): existe transacção com `date===row.date` e `Math.abs(amount - row.amount) < 0.005` mas com `external_ref` diferente ou nulo → marca `possibleDuplicateOf` mas **não** bloqueia o import. Apresenta badge "possível duplicado" + ícone clicável.
- Ampliar a janela: também sinalizar movimentos onde `Math.abs(date_diff) <= 3 dias` E `mesmo amount` — útil quando a data de valor difere do movimento.
- Por linha: badge laranja `possível duplicado` + botão `i` que abre Popover com detalhes da transacção candidata (data, valor, notas, categoria) e duas acções:
  - **"É o mesmo — ignorar"** → marca `ignore=true` na linha.
  - **"São diferentes — importar"** → limpa o aviso (`possibleDuplicateOf=null`).
- Adicionar contador no resumo do topo: badge `X possíveis duplicados`.
- Adicionar toggle global "Mostrar possíveis duplicados" (ON por defeito) caso o utilizador queira esconder.

### Detalhes técnicos

**Ficheiros a editar:**
- `src/components/integracoes/BankImportTab.tsx`
- `src/components/integracoes/ImportRulesTab.tsx`

**Sem alterações de schema.** Tudo usa colunas existentes em `transactions` e `import_rules`.

**Query do `handleParse`:** já carrega via `fetchAllRows` todas as transacções do utilizador (`date, amount, external_ref, notes, bank_source`). Adicionar `id, category_id` ao select e construir um segundo índice `Map<string, ExistingTx[]>` indexado por `date|amount` para o look-up de "possíveis duplicados".

```text
Linha 12:  CGD  10/05/2026  -45,00 €  "SEGURO XPTO"
   [auto] [valor exacto ☐]  [possível duplicado i]
                              └─> Já existe: 10/05/2026 -45,00€ "Pagamento seguro" (Seguros)
                                 [É o mesmo — ignorar]  [São diferentes — importar]
```
