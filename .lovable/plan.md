Plano:

1. Tornar o controlo claro e funcional
   - Renomear a coluna de “Ignorar” para algo explícito como “Importar”.
   - Para duplicados, mostrar um checkbox/toggle marcado como ignorado por defeito, mas com texto claro ao lado: “Ignorar” quando marcado / “Importar” quando desmarcado.
   - Evitar que o utilizador confunda esta checkbox com “valor exacto”.

2. Corrigir o estado visual da linha
   - Duplicados marcados para ignorar ficam esbatidos e com badge “duplicado”.
   - Quando o utilizador desmarca o controlo, a linha deixa de estar esbatida e passa a mostrar “vai importar”.

3. Corrigir a lógica de importação
   - A importação passa a depender apenas de `ignore === false` e da data de corte.
   - Duplicados deixam de estar bloqueados por flags antigas; se o utilizador desmarcar “Ignorar”, entram na contagem e no botão “Importar X movimentos”.

4. Limpar a UI antiga
   - Remover a coluna/estado extra que não aparece claramente no screenshot.
   - Remover qualquer lógica remanescente de “Importar mesmo assim”/`forceImport` para não haver conflito.

5. Validar o resultado
   - Verificar que uma linha duplicada aparece ignorada por defeito.
   - Verificar que ao desmarcar o controlo a contagem de movimentos a importar aumenta e a linha fica visualmente ativa.