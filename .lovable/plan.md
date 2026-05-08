## Bug

No dropdown de banco em `BankImportTab.tsx` (linha 431) a opção Wizink continua desativada com `disabled={b.value === 'wizink'}` — sobra da versão "em breve". Por isso a opção aparece esbatida e não é selecionável.

## Correção

- Remover o atributo `disabled` do `SelectItem`:

  ```tsx
  {BANK_OPTIONS.map(b => (
    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
  ))}
  ```

Sem mais alterações.
