## Objetivo

No separador "Importar Banco", durante o **preview** das linhas a importar, mostrar os **últimos 5 movimentos já importados** desse banco — para o utilizador perceber até onde já tinha chegado.

## Onde aparece

Painel compacto **só no `step === 'preview'`**, posicionado acima da tabela de linhas a importar e abaixo do resumo (badges de "X a importar / Y duplicados").

Quando o banco foi importado em modo "auto", usa o `bankSource` resultante (já presente em `parsed.bankSource`) para filtrar.

## Conteúdo do painel

Cabeçalho colapsável (aberto por defeito): "Últimos 5 importados de {Banco}".

Lista compacta de até 5 linhas:

```
DD/MM/AAAA   Descrição truncada (~40 chars)   Categoria   12,34 €
```

- Data tabular-nums.
- Valor com cor `text-income` / `text-expense` segundo `macro_group`, classe `financial-value` para Privacy Mode.
- Categoria em `text-muted-foreground` (resolvida via mapa `categories` já carregado).

Estado vazio: "Sem movimentos importados deste banco ainda."

## Dados

Carregamento feito uma vez no início do preview (junto com as queries já existentes em `loadPreview`):

```ts
supabase.from('transactions')
  .select('id, date, amount, notes, macro_group, category_id')
  .eq('user_id', userId)
  .eq('bank_source', parsed.bankSource)
  .order('date', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(5);
```

Resultado guardado em `useState<LastImported[]>` e renderizado no painel. Não precisa de count nem de refresh — quando o utilizador volta a abrir o preview depois de importar, é re-fetched naturalmente.

## Sem alterações

- Não toca em parsers, regras, lógica de inserção nem dedup.
- Sem migrations, sem ficheiros novos — tudo dentro de `BankImportTab.tsx`.
