

## Plano: Botões +/- na data do BulkAddDialog

Adicionar botões de incremento/decremento de dia ao lado do campo de data em cada linha do formulário multi-linha.

### Alterações em `src/components/movimentos/BulkAddDialog.tsx`

- Criar uma função helper `adjustDate(dateStr, days)` que soma/subtrai dias a uma data ISO
- Envolver o `<Input type="date">` com um grupo inline contendo:
  - Botão `-` (ChevronLeft ou Minus) à esquerda — recua 1 dia
  - Campo de data ao centro
  - Botão `+` (ChevronRight ou Plus) à direita — avança 1 dia
- Ajustar a largura da coluna de data de `100px` para ~`160px` no grid para acomodar os botões
- Importar ícones `ChevronLeft`/`ChevronRight` (já usados no projeto)

