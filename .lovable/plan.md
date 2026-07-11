Vou corrigir isto como um problema de UI: no teu screenshot aparece apenas um pequeno círculo ao lado de “valor exacto”, que é a checkbox errada — é a opção de regra por valor exato, não a opção de importar duplicado.

Plano:

1. Substituir a opção de duplicado por um controlo explícito e sempre visível na linha
   - Para linhas com badge “duplicado”, mostrar um botão/toggle claro ao lado do badge: “Importar mesmo assim”.
   - Quando ativo, mostrar “✓ a importar”.

2. Garantir que a opção também aparece para possíveis duplicados
   - Para “possível duplicado”, manter o popover, mas também deixar uma ação visível/óbvia para importar.

3. Evitar confusão com “valor exacto”
   - Separar visualmente o controlo “valor exacto” da ação de duplicado.
   - O texto “valor exacto” continuará a ser apenas para regras automáticas, não para importação de duplicados.

4. Ajustar a contagem/importação
   - Se marcares “Importar mesmo assim”, essa linha deixa de ser excluída por duplicado e entra na importação.

Depois de aprovares, implemento esta correção visual diretamente no ecrã de integrações.