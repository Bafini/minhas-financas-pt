## Causa do problema

Na app, todos os movimentos são guardados com **valor positivo** — a distinção entre receita e despesa faz-se pela coluna `macro_group` (`Rendimentos` / `Despesas` / `Investimentos`). Confirma-se isto em:

- `MovimentosPage` (form manual e edição inline) — guarda `parseFloat(formAmount)` sem inverter sinal.
- `BulkAddDialog` — só aceita `parseFloat(l.amount) > 0`.
- `calculations.ts`, `OrcamentosPage`, `fuelCardHelpers` — agregam por `macro_group`, assumindo valores positivos.

Mas os parsers de banco (`revolut.ts`, `wizink.ts`, `cgd.ts`, `generic.ts`) devolvem valores **com sinal** (negativo = despesa) e o `BankImportTab` insere esse valor diretamente em `transactions.amount`. Resultado: tudo o que vem do Revolut/Wizink fica com sinal negativo nas despesas, ao contrário dos lançamentos manuais.

O `macro_group` já é inferido corretamente a partir do sinal antes do insert (linha 213–214 de `BankImportTab.tsx`):
```
match?.rule.macro_group || (r.amount >= 0 ? 'Rendimentos' : 'Despesas')
```
…por isso podemos manter a lógica de classificação e apenas normalizar o valor.

## Alterações

**1. `src/components/integracoes/BankImportTab.tsx`**

- No insert (linha ~351), gravar `Math.abs(finalAmount)` em vez de `finalAmount`.
- Ao construir a `recurringExpectedAmount` e ao comparar com a regra recorrente (linhas 221–225, 332–337, 370, 609–612), usar `Math.abs(r.amount)` para que a comparação seja consistente (recurring rules também guardam valores positivos).
- Na atribuição automática de `macroGroup` (linha 214) manter `r.amount >= 0 ? 'Rendimentos' : 'Despesas'` — a inferência continua a depender do sinal devolvido pelo parser.
- Na deteção de duplicados (linhas 138, 148, 175–200) passar a comparar por `Math.abs(r.amount)` contra `Math.abs(e.amount)`, para que importações repetidas continuem a ser detetadas mesmo com a normalização.
- Na exibição da coluna "Valor" (linha 668), usar a cor com base em `row.macroGroup === 'Rendimentos' ? text-income : text-expense` e mostrar `Math.abs(row.amount)` formatado, para o utilizador ver o valor já como vai ficar gravado.

**2. `src/components/integracoes/ImportRulesTab.tsx` (verificação)**

- Confirmar que a regra `match_field === 'description+amount'` compara também por valor absoluto (caso contrário regras criadas a partir de movimentos manuais — positivos — nunca casariam com importações negativas). Ajustar `applyImportRules` em `src/lib/importRules.ts` se necessário.

**3. Sem alterações nos parsers**

`revolut.ts`, `wizink.ts`, `cgd.ts` e `generic.ts` continuam a devolver valores com sinal — esse sinal é necessário para inferir `macro_group`. Só o ponto de inserção é que normaliza para positivo.

## Notas

- Não é preciso migração de dados: movimentos antigos importados que ficaram negativos podem ser corrigidos com um UPDATE manual posterior, se quiseres. Posso preparar essa migração à parte.
- Não toca em parsers nem em lógica de cálculo — apenas alinha a importação à convenção da app.
