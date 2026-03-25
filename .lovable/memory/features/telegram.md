Telegram bot integration for expense registration via messaging.

## Tables
- `telegram_bot_state`: singleton (id=1) for getUpdates offset tracking
- `telegram_user_links`: maps chat_id to user_id, stores mode and active_card_id

## Edge Functions
- `telegram-link`: generates 6-digit codes, checks status, unlinks
- `telegram-poll`: long-polling loop (55s), processes all commands

## Commands
- /start, /ajuda, /vincular, /desvincular
- /saldo, /semana, /ultimos, /categorias, /cartoes, /categoria
- /rendimento, /investimento, /despesa, /cartao, /anular
- Free text: [valor] [notas] — registers transaction with fuzzy subcategory match

## Cron
- pg_cron job `poll-telegram-updates` runs every minute
- Connector: Telegram (std_01kmkn188wfnf9w5y9kxht718r)

## UI
- TelegramSection component in DefinicoesPage (hidden for demo users)
