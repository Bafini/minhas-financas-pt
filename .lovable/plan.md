

## Plano: Evolucao dos Eventos

### Resumo
- Adicionar campo `is_active` a tabela `event_labels`
- Permitir criar eventos manualmente (ja existe botao, mas precisa recarregar lista apos criacao)
- No registo de movimentos, substituir o campo "Notas" (texto livre) por uma combo "Evento" que lista apenas eventos ativos
- As transacoes passam a usar `event_label` como referencia ao nome do evento (ja e assim), mas o campo `notes` desaparece da UI de registo
- Manter sugestoes na pagina de Eventos para criar eventos a partir de notas existentes

### Passo 1 — Migracao de Base de Dados

Adicionar coluna `is_active` a tabela `event_labels`:
```sql
ALTER TABLE event_labels ADD COLUMN is_active boolean NOT NULL DEFAULT true;
```

### Passo 2 — Pagina de Eventos (`EventosPage.tsx`)

- Adicionar toggle ativo/inativo em cada card de evento (switch ou badge clicavel)
- O dialog de criacao manual ja existe — garantir que apos criar, a lista recarrega (adicionar `loadAll()` apos sucesso)
- Mostrar visualmente eventos inativos (opacidade reduzida, badge "Inativo")
- Filtro para mostrar/esconder inativos

### Passo 3 — Movimentos (`MovimentosPage.tsx`)

- Carregar eventos ativos do utilizador (`event_labels` com `is_active = true`)
- Substituir o campo "Notas" (`Textarea`) por uma `Select` com label "Evento"
- Opcoes: "Nenhum" + lista de eventos ativos
- O campo nao e obrigatorio (pode ficar sem evento)
- Aplicar tanto no formulario Sheet como na linha inline
- No `payload` do save, guardar o nome do evento selecionado em `event_label` (como ja funciona)
- Remover `notes`/`formNotes`/`inlineNotes` da UI (o campo `notes` na BD pode manter-se para dados historicos mas deixa de ser editavel)

### Passo 4 — Tabela de listagem

- Renomear coluna "Notas" para "Evento" na tabela de movimentos
- Mostrar o `event_label` em vez de `notes`

### Passo 5 — Telegram Bot

- Atualizar a funcao `telegram-poll` para que quando o utilizador envia texto, o campo `notes` continue a ser preenchido (o bot pode manter notas como texto livre, sendo um canal diferente)

### Ficheiros a editar

1. **Migracao SQL** — adicionar `is_active` a `event_labels`
2. **`src/pages/EventosPage.tsx`** — toggle ativo/inativo, melhorar criacao manual
3. **`src/pages/MovimentosPage.tsx`** — substituir campo Notas por combo Evento
4. **`src/lib/queries.ts`** — adicionar funcao `fetchEventLabels` se necessario (ja existe)

