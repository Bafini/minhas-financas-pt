

## Plano: Entrada de Movimentos em Lote

Duas funcionalidades novas na página de Movimentos:

### 1. Duplicar Movimento

Ao clicar num movimento existente (ou via botão na linha), abrir um dialog que permite:
- Ver os dados do movimento original (categoria, subcategoria, grupo, evento)
- Definir N linhas com **data** e **valor** (pré-preenchidos com os do original)
- Adicionar/remover linhas dinamicamente
- Botão "Criar N movimentos" que insere todos de uma vez

Útil para: duplicar despesas de viagem, replicar movimentos recorrentes com valores diferentes.

### 2. Formulário Multi-Linha

Novo botão "Adicionar Vários" que abre um dialog/sheet com:
- Uma tabela editável com N linhas (começa com 3 vazias)
- Cada linha tem: Data, Grupo, Categoria, Subcategoria, Valor, Evento
- Botão "+" para adicionar mais linhas
- Botão "Criar Todos" que insere todas as linhas válidas de uma vez
- Campos partilhados opcionais no topo (grupo, categoria, evento) que pré-preenchem todas as linhas — evita repetição

### Implementação Técnica

**Ficheiro**: `src/pages/MovimentosPage.tsx`

- Novo componente `BulkAddDialog` — dialog com tabela multi-linha
- Novo componente `DuplicateDialog` — dialog para duplicar com datas/valores
- Botão "Duplicar" adicionado às ações de cada linha da tabela (ícone Copy)
- Botão "Adicionar Vários" no header junto aos botões existentes
- Inserção em batch via `supabase.from('transactions').insert([...array])` (uma única chamada)
- Recálculo de fuel cards se aplicável

**Nenhuma alteração de base de dados necessária** — usa a mesma tabela `transactions`.

