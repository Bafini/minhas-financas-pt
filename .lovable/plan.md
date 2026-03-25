

## Plano: Bot Telegram para Registo de Despesas (Todos os Comandos)

### Passo 0 — Conectar o Telegram

Antes de implementar, e necessario configurar o conector Telegram para obter as credenciais do bot. Sera pedido ao utilizador para conectar o Telegram ao projeto.

### Passo 1 — Base de Dados (Migracao)

Criar 2 tabelas:

- **`telegram_bot_state`** — singleton para tracking do offset de polling
  - `id` (int, PK, check = 1), `update_offset` (bigint), `updated_at`
  
- **`telegram_user_links`** — associacao chat_id ao user_id
  - `id` (uuid), `user_id` (uuid), `chat_id` (bigint, UNIQUE), `link_code` (text, nullable), `link_code_expires` (timestamptz, nullable), `created_at`
  - RLS: utilizadores veem apenas os seus registos

### Passo 2 — Edge Function: `telegram-link`

Chamada pelo frontend para gerar um codigo de 6 digitos temporario (valido 10 minutos). Guarda o codigo na tabela `telegram_user_links` associado ao `user_id`.

### Passo 3 — Edge Function: `telegram-poll`

Polling com `getUpdates` via gateway, loop de ate 55 segundos. Processa mensagens e responde conforme o comando:

**Comandos implementados:**

| Comando | Descricao |
|---------|-----------|
| `/start` | Mensagem de boas-vindas com instrucoes |
| `/ajuda` | Lista todos os comandos disponiveis |
| `/vincular [codigo]` | Associa o chat_id ao user_id usando o codigo de 6 digitos |
| `/desvincular` | Remove a associacao chat_id/user_id |
| `/saldo` | Resumo do mes atual: rendimentos, despesas, investimentos, saldo liquido |
| `/semana` | Resumo dos ultimos 7 dias |
| `/ultimos [n]` | Lista as ultimas N transacoes (default 5) |
| `/categorias` | Lista as categorias ativas do utilizador |
| `/cartoes` | Lista cartoes ativos com plafond restante |
| `/categoria [nome]` | Mostra gastos do mes na categoria especificada |
| `/anular` | Apaga a ultima transacao registada pelo bot |
| `/rendimento` | Muda o modo para registar o proximo valor como rendimento |
| `/investimento` | Muda o modo para registar o proximo valor como investimento |
| `/despesa` | Volta ao modo default (despesas) |
| `/cartao [nome]` | Associa o proximo registo a um cartao especifico |
| (mensagem livre) | `[valor] [notas]` — regista transacao com fuzzy match de subcategoria |

**Logica de registo de mensagens livres:**
1. Extrai valor numerico (aceita virgula ou ponto)
2. Texto restante usado como notas
3. Fuzzy match nas subcategorias do grupo ativo (Despesas por default)
4. Se encontrar match, atribui categoria/subcategoria
5. Se cartao estiver ativo no modo, verifica plafond e gera rendimento automatico
6. Responde com confirmacao formatada

### Passo 4 — Cron Job (pg_cron)

Agendar `telegram-poll` a cada minuto via `pg_cron` + `pg_net`. Executado via insert tool (nao migracao) por conter dados do projeto.

### Passo 5 — UI em Definicoes

Nova seccao "Bot Telegram" na pagina `DefinicoesPage.tsx`:
- Botao "Vincular conta" que gera e mostra codigo de 6 digitos
- Instrucoes: "Envie `/vincular CODIGO` ao bot @NomeDoBot no Telegram"
- Estado da vinculacao (vinculado/nao vinculado)
- Botao para desvincular
- Escondido para utilizador demo

### Seccao Tecnica

```text
┌──────────┐  msg   ┌──────────────┐  getUpdates  ┌─────────┐
│ Telegram │ ─────> │ telegram-poll│ <──────────── │ Gateway │
│  User    │ <───── │ (Edge Fn)    │ ────────────> │Telegram │
└──────────┘ reply  └──────┬───────┘  sendMessage  └─────────┘
                           │
                    ┌──────▼───────┐
                    │  Supabase DB │
                    │ transactions │
                    │ telegram_*   │
                    └──────────────┘
```

- Transacoes criadas pelo bot: `auto_generated = true`, `notes` preenchido
- Grupo default: Despesas (alteravel com `/rendimento`, `/investimento`, `/despesa`)
- Estado do modo (grupo ativo, cartao) guardado em memoria da edge function por `chat_id` (reset entre invocacoes, simples e suficiente)

### Ficheiros a criar/editar

1. **Migracao SQL** — tabelas `telegram_bot_state` e `telegram_user_links`
2. **`supabase/functions/telegram-poll/index.ts`** — edge function principal
3. **`supabase/functions/telegram-link/index.ts`** — edge function para gerar codigos
4. **`src/pages/DefinicoesPage.tsx`** — nova seccao Bot Telegram
5. **SQL via insert tool** — cron job `pg_cron`

