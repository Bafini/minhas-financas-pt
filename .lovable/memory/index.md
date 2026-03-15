# Memory: index.md
Updated: now

Financial management platform (Soberania Financeira) - PT-PT, EUR, DD/MM/YYYY format.

## Design System
- Font: Inter
- Colors: income (emerald), expense (coral red), investment (royal blue)
- Semantic tokens: --income, --expense, --investment, --warning
- Style: Matte Ceramic surfaces, glass-surface utility class
- Financial values: tabular-nums, -0.03em tracking (.financial-value)
- No donut charts for complex data; use bars/treemaps

## Database
- 11 tables: profiles, categories, subcategories, transactions, imports, import_rows, recurring_rules, budgets, event_labels, saved_filters, fuel_cards
- Enums: macro_group (Rendimentos/Investimentos/Despesas), frequency_type
- All tables have RLS per user_id
- Auto-profile creation on signup trigger
- Categories seeded per user on first login
- transactions has: fuel_card_id, linked_transaction_id, auto_generated columns

## Architecture
- Auth: AuthContext with Supabase auth
- Pages: Dashboard, Movimentos, Comparações, Rendimentos, Despesas, Investimentos, Categorias, Orçamentos, Recorrências, Cartões Combustível, Eventos, Integrações, Definições
- Lib: formatters.ts, calculations.ts, queries.ts, seeds.ts, fuelCardHelpers.ts, supabaseHelpers.ts
- CSV import with PapaParse, duplicate detection, category auto-creation
- Fuel cards: auto-generate income transactions when fuel expense with card, capped at monthly_limit

## Anti-patterns
- No modals for tx editing (use Sheets)
- No red for investment losses (use gray/amber)
- Pagination (50/100), no infinite scroll
- Always DD/MM/YYYY dates, never relative
