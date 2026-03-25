import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return errorResp('LOVABLE_API_KEY is not configured');

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) return errorResp('TELEGRAM_API_KEY is not configured');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) return errorResp(stateErr.message);

  let currentOffset = state.update_offset;
  let totalProcessed = 0;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset: currentOffset, timeout, allowed_updates: ['message'] }),
    });

    const data = await response.json();
    if (!response.ok) return errorResp(JSON.stringify(data), 502);

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const update of updates) {
      if (!update.message?.text && !update.message) continue;
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').trim();

      try {
        await processMessage(supabase, chatId, text, LOVABLE_API_KEY, TELEGRAM_API_KEY);
      } catch (e) {
        console.error(`Error processing message from ${chatId}:`, e);
      }
      totalProcessed++;
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);
    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }));
});

function errorResp(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), { status });
}

async function sendTelegram(chatId: number, text: string, lovableKey: string, telegramKey: string) {
  const resp = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  await resp.json();
}

async function processMessage(
  supabase: any,
  chatId: number,
  text: string,
  lovableKey: string,
  telegramKey: string
) {
  const send = (msg: string) => sendTelegram(chatId, msg, lovableKey, telegramKey);

  // Check if user is linked
  const { data: link } = await supabase
    .from('telegram_user_links')
    .select('*')
    .eq('chat_id', chatId)
    .limit(1);

  const userLink = link && link.length > 0 ? link[0] : null;

  // Handle /start
  if (text === '/start') {
    await send(
      '👋 <b>Olá! Bem-vindo ao bot de finanças.</b>\n\n' +
      'Para começar, vincule a sua conta:\n' +
      '1. Vá a Definições na app\n' +
      '2. Clique em "Vincular conta Telegram"\n' +
      '3. Envie aqui: <code>/vincular CODIGO</code>\n\n' +
      'Use /ajuda para ver todos os comandos.'
    );
    return;
  }

  // Handle /ajuda
  if (text === '/ajuda') {
    await send(
      '📖 <b>Comandos disponíveis:</b>\n\n' +
      '🔗 <b>Gestão</b>\n' +
      '/vincular [código] — Vincular conta\n' +
      '/desvincular — Desvincular conta\n\n' +
      '📊 <b>Consulta</b>\n' +
      '/saldo — Resumo do mês\n' +
      '/semana — Resumo dos últimos 7 dias\n' +
      '/ultimos [n] — Últimas N transações\n' +
      '/categorias — Categorias ativas\n' +
      '/cartoes — Cartões e plafond\n' +
      '/categoria [nome] — Gastos por categoria\n\n' +
      '💰 <b>Registo</b>\n' +
      '/despesa — Modo despesa (default)\n' +
      '/rendimento — Modo rendimento\n' +
      '/investimento — Modo investimento\n' +
      '/cartao [nome] — Associar próximo registo a cartão\n' +
      '/anular — Apagar último registo\n\n' +
      '📝 <b>Registar transação:</b>\n' +
      'Envie: <code>25.50 Supermercado</code>'
    );
    return;
  }

  // Handle /vincular
  if (text.startsWith('/vincular')) {
    const code = text.split(/\s+/)[1];
    if (!code) {
      await send('❌ Use: <code>/vincular CODIGO</code>');
      return;
    }

    const { data: linkRow } = await supabase
      .from('telegram_user_links')
      .select('*')
      .eq('link_code', code)
      .gt('link_code_expires', new Date().toISOString())
      .is('chat_id', null)
      .limit(1);

    if (!linkRow || linkRow.length === 0) {
      await send('❌ Código inválido ou expirado. Gere um novo na app.');
      return;
    }

    await supabase
      .from('telegram_user_links')
      .update({ chat_id: chatId, link_code: null, link_code_expires: null })
      .eq('id', linkRow[0].id);

    await send('✅ Conta vinculada com sucesso! Envie um valor para registar uma despesa.');
    return;
  }

  // All other commands require linked account
  if (!userLink) {
    await send('🔒 Conta não vinculada. Use /start para instruções.');
    return;
  }

  const userId = userLink.user_id;

  // /desvincular
  if (text === '/desvincular') {
    await supabase.from('telegram_user_links').delete().eq('id', userLink.id);
    await send('✅ Conta desvinculada.');
    return;
  }

  // /saldo
  if (text === '/saldo') {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, macro_group')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    let income = 0, expense = 0, invest = 0;
    for (const tx of txs || []) {
      const amt = Number(tx.amount);
      if (tx.macro_group === 'Rendimentos') income += amt;
      else if (tx.macro_group === 'Despesas') expense += amt;
      else invest += amt;
    }

    const balance = income - expense - invest;
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    await send(
      `📊 <b>Resumo de ${monthNames[now.getMonth()]}:</b>\n\n` +
      `🟢 Rendimentos: €${income.toFixed(2)}\n` +
      `🔴 Despesas: €${expense.toFixed(2)}\n` +
      `🔵 Investimentos: €${invest.toFixed(2)}\n` +
      `━━━━━━━━━━━━━━\n` +
      `💰 Saldo: €${balance.toFixed(2)}`
    );
    return;
  }

  // /semana
  if (text === '/semana') {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, macro_group')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    let income = 0, expense = 0, invest = 0;
    for (const tx of txs || []) {
      const amt = Number(tx.amount);
      if (tx.macro_group === 'Rendimentos') income += amt;
      else if (tx.macro_group === 'Despesas') expense += amt;
      else invest += amt;
    }

    await send(
      `📊 <b>Últimos 7 dias:</b>\n\n` +
      `🟢 Rendimentos: €${income.toFixed(2)}\n` +
      `🔴 Despesas: €${expense.toFixed(2)}\n` +
      `🔵 Investimentos: €${invest.toFixed(2)}`
    );
    return;
  }

  // /ultimos [n]
  if (text.startsWith('/ultimos')) {
    const n = parseInt(text.split(/\s+/)[1] || '5', 10);
    const limit = Math.min(Math.max(n, 1), 20);

    const { data: txs } = await supabase
      .from('transactions')
      .select('date, amount, macro_group, notes')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (!txs || txs.length === 0) {
      await send('📭 Sem transações registadas.');
      return;
    }

    const icons: Record<string, string> = { Rendimentos: '🟢', Despesas: '🔴', Investimentos: '🔵' };
    const lines = txs.map(tx => {
      const d = tx.date.split('-').reverse().join('/');
      return `${icons[tx.macro_group] || '⚪'} ${d} — €${Number(tx.amount).toFixed(2)}${tx.notes ? ` (${tx.notes})` : ''}`;
    });

    await send(`📋 <b>Últimas ${txs.length} transações:</b>\n\n${lines.join('\n')}`);
    return;
  }

  // /categorias
  if (text === '/categorias') {
    const { data: cats } = await supabase
      .from('categories')
      .select('name, group_type')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('group_type')
      .order('name');

    if (!cats || cats.length === 0) {
      await send('📭 Sem categorias.');
      return;
    }

    const grouped: Record<string, string[]> = {};
    for (const c of cats) {
      if (!grouped[c.group_type]) grouped[c.group_type] = [];
      grouped[c.group_type].push(c.name);
    }

    const icons: Record<string, string> = { Rendimentos: '🟢', Despesas: '🔴', Investimentos: '🔵' };
    let msg = '📂 <b>Categorias ativas:</b>\n\n';
    for (const [group, names] of Object.entries(grouped)) {
      msg += `${icons[group] || ''} <b>${group}</b>\n`;
      msg += names.map(n => `  • ${n}`).join('\n') + '\n\n';
    }

    await send(msg);
    return;
  }

  // /cartoes
  if (text === '/cartoes') {
    const { data: cards } = await supabase
      .from('fuel_cards')
      .select('card_name, monthly_limit, limit_type, is_active, effective_from')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('card_name');

    if (!cards || cards.length === 0) {
      await send('📭 Sem cartões ativos.');
      return;
    }

    const now = new Date();
    let msg = '💳 <b>Cartões ativos:</b>\n\n';

    for (const card of cards) {
      const startDate = card.limit_type === 'monthly'
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        : card.effective_from;
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

      const { data: expenses } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('fuel_card_id', card.card_name) // Note: we need card id, but we only have name here
        .eq('macro_group', 'Despesas')
        .gte('date', startDate)
        .lte('date', endDate);

      // Simplified: just show limit
      const limit = Number(card.monthly_limit);
      const type = card.limit_type === 'monthly' ? 'Mensal' : 'Único';
      msg += `💳 <b>${card.card_name}</b> (${type})\n   Plafond: €${limit.toFixed(2)}\n\n`;
    }

    await send(msg);
    return;
  }

  // /categoria [nome]
  if (text.startsWith('/categoria ')) {
    const catName = text.slice(11).trim();
    if (!catName) {
      await send('❌ Use: <code>/categoria NomeDaCategoria</code>');
      return;
    }

    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, group_type')
      .eq('user_id', userId)
      .ilike('name', `%${catName}%`)
      .limit(1);

    if (!cats || cats.length === 0) {
      await send(`❌ Categoria "${catName}" não encontrada.`);
      return;
    }

    const cat = cats[0];
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category_id', cat.id)
      .gte('date', startDate)
      .lte('date', endDate);

    const total = (txs || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    await send(`📂 <b>${cat.name}</b> (${cat.group_type})\n\nTotal este mês: €${total.toFixed(2)} (${(txs || []).length} transações)`);
    return;
  }

  // /anular
  if (text === '/anular') {
    const { data: lastTx } = await supabase
      .from('transactions')
      .select('id, amount, macro_group, notes, date')
      .eq('user_id', userId)
      .eq('auto_generated', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!lastTx || lastTx.length === 0) {
      await send('📭 Sem transações do bot para anular.');
      return;
    }

    const tx = lastTx[0];
    await supabase.from('transactions').delete().eq('id', tx.id);

    // Also delete linked income transaction if exists
    const { data: linkedTxs } = await supabase
      .from('transactions')
      .select('id')
      .eq('linked_transaction_id', tx.id);

    if (linkedTxs && linkedTxs.length > 0) {
      for (const lt of linkedTxs) {
        await supabase.from('transactions').delete().eq('id', lt.id);
      }
    }

    await send(
      `🗑️ <b>Transação anulada:</b>\n` +
      `€${Number(tx.amount).toFixed(2)} — ${tx.macro_group}\n` +
      `${tx.notes || 'Sem notas'} (${tx.date.split('-').reverse().join('/')})`
    );
    return;
  }

  // /rendimento, /investimento, /despesa — change mode
  if (text === '/rendimento' || text === '/investimento' || text === '/despesa') {
    const modeMap: Record<string, string> = {
      '/rendimento': 'Rendimentos',
      '/investimento': 'Investimentos',
      '/despesa': 'Despesas',
    };
    const newMode = modeMap[text];
    await supabase
      .from('telegram_user_links')
      .update({ mode: newMode, active_card_id: null })
      .eq('id', userLink.id);

    const icons: Record<string, string> = { Rendimentos: '🟢', Despesas: '🔴', Investimentos: '🔵' };
    await send(`${icons[newMode]} Modo alterado para <b>${newMode}</b>. O próximo valor será registado neste grupo.`);
    return;
  }

  // /cartao [nome]
  if (text.startsWith('/cartao')) {
    const cardName = text.slice(7).trim();
    if (!cardName) {
      // Clear card mode
      await supabase
        .from('telegram_user_links')
        .update({ active_card_id: null })
        .eq('id', userLink.id);
      await send('💳 Modo cartão desativado.');
      return;
    }

    const { data: cards } = await supabase
      .from('fuel_cards')
      .select('id, card_name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .ilike('card_name', `%${cardName}%`)
      .limit(1);

    if (!cards || cards.length === 0) {
      await send(`❌ Cartão "${cardName}" não encontrado.`);
      return;
    }

    await supabase
      .from('telegram_user_links')
      .update({ active_card_id: cards[0].id })
      .eq('id', userLink.id);

    await send(`💳 Próximo registo será associado ao cartão <b>${cards[0].card_name}</b>.`);
    return;
  }

  // Free text — register transaction
  // Extract amount: first number in the message (supports comma and dot)
  const amountMatch = text.match(/(\d+[.,]\d+|\d+)/);
  if (!amountMatch) {
    await send('❓ Não percebi. Envie um valor (ex: <code>25.50 Supermercado</code>) ou /ajuda.');
    return;
  }

  const amount = parseFloat(amountMatch[1].replace(',', '.'));
  if (isNaN(amount) || amount <= 0) {
    await send('❌ Valor inválido.');
    return;
  }

  const notes = text.replace(amountMatch[0], '').trim() || null;
  const mode = userLink.mode || 'Despesas';
  const activeCardId = userLink.active_card_id;
  const today = new Date().toISOString().split('T')[0];

  // Fuzzy match subcategory from notes
  let categoryId: string | null = null;
  let subcategoryId: string | null = null;

  if (notes) {
    const { data: subcats } = await supabase
      .from('subcategories')
      .select('id, name, category_id, categories(group_type)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (subcats) {
      const notesLower = notes.toLowerCase();
      // Try exact match first, then partial
      let match = subcats.find((s: any) => s.name.toLowerCase() === notesLower && s.categories?.group_type === mode);
      if (!match) {
        match = subcats.find((s: any) => notesLower.includes(s.name.toLowerCase()) && s.categories?.group_type === mode);
      }
      if (!match) {
        match = subcats.find((s: any) => s.name.toLowerCase().includes(notesLower) && s.categories?.group_type === mode);
      }
      if (match) {
        subcategoryId = match.id;
        categoryId = match.category_id;
      }
    }
  }

  // If no subcategory found, try to find default category
  if (!categoryId) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('group_type', mode)
      .eq('is_active', true)
      .limit(1);

    if (cats && cats.length > 0) {
      categoryId = cats[0].id;
    }
  }

  // Insert transaction
  const txData: any = {
    user_id: userId,
    date: today,
    amount,
    macro_group: mode,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    notes: notes || 'Via Telegram',
    auto_generated: true,
    fuel_card_id: activeCardId,
  };

  const { data: insertedTx, error: insertErr } = await supabase
    .from('transactions')
    .insert(txData)
    .select('id')
    .single();

  if (insertErr) {
    console.error('Insert error:', insertErr);
    await send('❌ Erro ao registar transação.');
    return;
  }

  // If card is active and mode is Despesas, auto-generate income
  let incomeMsg = '';
  if (activeCardId && mode === 'Despesas') {
    const { data: card } = await supabase
      .from('fuel_cards')
      .select('*, subcategories(id, name, category_id)')
      .eq('id', activeCardId)
      .single();

    if (card && card.income_subcategory_id && card.subcategories?.category_id) {
      // Calculate remaining plafond
      const isOneTime = card.limit_type === 'one_time';
      const startDate = isOneTime ? card.effective_from : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

      const { data: cardExpenses } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('fuel_card_id', activeCardId)
        .eq('macro_group', 'Despesas')
        .gte('date', startDate);

      const totalSpent = (cardExpenses || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const limit = Number(card.monthly_limit);
      const eligible = Math.min(amount, Math.max(0, limit - (totalSpent - amount)));

      if (eligible > 0) {
        const incomeData = {
          user_id: userId,
          date: today,
          amount: eligible,
          macro_group: 'Rendimentos' as const,
          category_id: card.subcategories.category_id,
          subcategory_id: card.income_subcategory_id,
          fuel_card_id: activeCardId,
          auto_generated: true,
          linked_transaction_id: insertedTx.id,
          notes: `${card.card_name} — rendimento automático`,
        };

        await supabase.from('transactions').insert(incomeData);
        incomeMsg = `\n🟢 Rendimento auto: €${eligible.toFixed(2)} (${card.card_name})`;
      }
    }

    // Reset card mode after use
    await supabase
      .from('telegram_user_links')
      .update({ active_card_id: null })
      .eq('id', userLink.id);
  }

  const icons: Record<string, string> = { Rendimentos: '🟢', Despesas: '🔴', Investimentos: '🔵' };
  const subcatName = subcategoryId ? '' : '';
  let confirmMsg = `${icons[mode] || '⚪'} <b>Registado:</b> €${amount.toFixed(2)} — ${mode}\n`;
  confirmMsg += `📅 ${today.split('-').reverse().join('/')}`;
  if (notes) confirmMsg += `\n📝 ${notes}`;
  if (subcategoryId) {
    // Get subcategory name for display
    const { data: subcat } = await supabase
      .from('subcategories')
      .select('name, categories(name)')
      .eq('id', subcategoryId)
      .single();
    if (subcat) {
      confirmMsg += `\n📂 ${(subcat as any).categories?.name} > ${subcat.name}`;
    }
  }
  confirmMsg += incomeMsg;

  await send(confirmMsg);

  // Reset mode back to default after registering if not Despesas
  if (mode !== 'Despesas') {
    await supabase
      .from('telegram_user_links')
      .update({ mode: 'Despesas' })
      .eq('id', userLink.id);
  }
}
