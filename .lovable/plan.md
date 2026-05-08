## Objectivo

Suportar a importação do extracto Wizink no separador "Importar Banco". O ficheiro fornecido (`Movimiento_Wizinks.xls`) é uma folha com colunas:

`Data da transação | Número do cartão | Descrição da transação | Cidade | Montante transação (€) | Montante original`

A Wizink é um cartão de crédito: valores **positivos** representam gastos (compras) e **negativos** representam pagamentos da fatura ou créditos/estornos. Na convenção interna do projecto, despesas são **negativas** e rendimentos **positivos**, pelo que o sinal terá de ser invertido na importação.

## Alterações

### 1. Nova dependência
- Adicionar `xlsx` (SheetJS) — lê tanto `.xls` binário como variantes HTML/XML que muitos bancos exportam disfarçadas de XLS.

### 2. Novo parser `src/lib/bankParsers/wizink.ts`
- Função `parseWizinkXls(buffer: ArrayBuffer): { rows: ParsedBankRow[]; errors: string[] }`.
- Usa `XLSX.read(buffer, { type: 'array', cellDates: false })` e percorre a primeira folha como matriz.
- Detecta a linha de cabeçalho procurando "Data da transação" / "Montante" (tolerante a acentos e espaços).
- Para cada linha:
  - Data em `DD/MM/YYYY` → ISO `YYYY-MM-DD`.
  - Descrição = `Descrição da transação` + (` ` + `Cidade`) quando `Cidade` adiciona contexto e não duplica.
  - Montante: parse numérico (aceita `,` ou `.`); **inverter sinal** (`amount = -raw`).
  - `bankSource: 'wizink'`, `externalRef = description` (descrição já é estável; cartão `*2073` normalmente repete-se).
  - Ignorar linhas sem data ou sem montante (cabeçalhos repetidos, totais, linhas vazias).

### 3. Atualizar `src/lib/bankParsers/index.ts`
- `parseBankFile` passa a ler `ArrayBuffer` quando a extensão é `.xls` / `.xlsx` ou `bankSource === 'wizink'`, em vez de só texto.
- `detectBank`: se a extensão for `.xls`/`.xlsx` → `wizink`. Manter detecção textual existente para CSVs.
- Substituir o ramo `wizink` (que devolvia erro "ainda não disponível") por chamada a `parseWizinkXls`.

### 4. UI — `src/components/integracoes/BankImportTab.tsx`
- Atualizar a entrada Wizink em `BANK_OPTIONS`:
  - label: `Wizink (XLS)`
  - accept: `.xls,.xlsx`
- Atualizar o `accept` de `auto` para incluir `.xls,.xlsx` (para drag-and-drop).

## Sem alterações
- Schema da BD, regras de import, lógica de duplicados e match de recorrências permanecem iguais — a Wizink integra-se automaticamente no pipeline existente assim que devolver `ParsedBankRow[]` no formato standard.

## Verificação
Após implementar, importar o ficheiro fornecido e confirmar:
- Cerca de 100 linhas de movimento aparecem no preview.
- Compras (ex: "PRET A MANGER COLOMB" 2,00 €) ficam como **-2,00 €** (despesa).
- "Pagamento por débito direto" -1.136,48 € fica como **+1.136,48 €** (entrada — embora habitualmente o utilizador o vá ignorar para não duplicar com o débito na conta CGD).
