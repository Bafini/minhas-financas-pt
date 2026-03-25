import { supabase } from '@/integrations/supabase/client';

export interface FuelCard {
  id: string;
  user_id: string;
  card_name: string;
  card_type: string;
  monthly_limit: number;
  limit_type: 'monthly' | 'one_time';
  income_subcategory_id: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  subcategories?: { id: string; name: string; category_id: string } | null;
  expense_subcategory_ids?: string[];
  _totalSpentAllTime?: number; // populated for one_time cards to check exhaustion
}

export async function fetchFuelCards(userId: string): Promise<FuelCard[]> {
  const { data, error } = await supabase
    .from('fuel_cards')
    .select('*, subcategories(id, name, category_id)')
    .eq('user_id', userId)
    .order('card_name');
  if (error) throw error;

  // Fetch expense subcategory mappings
  const { data: mappings } = await supabase
    .from('card_expense_subcategories')
    .select('card_id, subcategory_id')
    .eq('user_id', userId);

  const mappingsByCard: Record<string, string[]> = {};
  for (const m of mappings || []) {
    if (!mappingsByCard[m.card_id]) mappingsByCard[m.card_id] = [];
    mappingsByCard[m.card_id].push(m.subcategory_id);
  }

  // For one_time cards, fetch total spent all time to check exhaustion
  const oneTimeCardIds = (data || []).filter(c => c.limit_type === 'one_time').map(c => c.id);
  const spentByCard: Record<string, number> = {};

  if (oneTimeCardIds.length > 0) {
    const { data: expenses } = await supabase
      .from('transactions')
      .select('fuel_card_id, amount')
      .eq('user_id', userId)
      .eq('macro_group', 'Despesas')
      .in('fuel_card_id', oneTimeCardIds);

    for (const tx of expenses || []) {
      if (tx.fuel_card_id) {
        spentByCard[tx.fuel_card_id] = (spentByCard[tx.fuel_card_id] || 0) + Number(tx.amount);
      }
    }
  }

  return (data || []).map(card => ({
    ...card,
    expense_subcategory_ids: mappingsByCard[card.id] || [],
    _totalSpentAllTime: card.limit_type === 'one_time' ? (spentByCard[card.id] || 0) : undefined,
  })) as FuelCard[];
}

/**
 * Get cards that are linked to a specific expense subcategory
 */
export function getCardsForSubcategory(cards: FuelCard[], subcategoryId: string): FuelCard[] {
  return cards.filter(c => {
    if (!c.is_active) return false;
    if (!(c.expense_subcategory_ids || []).includes(subcategoryId)) return false;
    // For one_time cards, check if plafond is exhausted
    if (c.limit_type === 'one_time' && c._totalSpentAllTime != null && c._totalSpentAllTime >= Number(c.monthly_limit)) {
      return false;
    }
    return true;
  });
}

/**
 * Check if a subcategory has any cards linked to it
 */
export function hasCardsForSubcategory(cards: FuelCard[], subcategoryId: string): boolean {
  return getCardsForSubcategory(cards, subcategoryId).length > 0;
}

/**
 * Recalculates card income transactions for a given month/year.
 */
export async function recalculateFuelCardIncome(
  userId: string,
  year: number,
  month: number,
  fuelCardId?: string
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  let cardsQuery = supabase
    .from('fuel_cards')
    .select('*, subcategories(id, name, category_id)')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  if (fuelCardId) {
    cardsQuery = cardsQuery.eq('id', fuelCardId);
  }

  const { data: cards, error: cardsError } = await cardsQuery;
  if (cardsError) throw cardsError;
  if (!cards || cards.length === 0) return;

  for (const card of cards) {
    if (!card.income_subcategory_id || !card.subcategories?.category_id) continue;

    if (card.effective_from > endDate) continue;
    if (card.effective_to && card.effective_to < startDate) continue;

    const effectiveStart = card.effective_from > startDate ? card.effective_from : startDate;

    const { data: expenses, error: expError } = await supabase
      .from('transactions')
      .select('amount, date')
      .eq('user_id', userId)
      .eq('fuel_card_id', card.id)
      .eq('macro_group', 'Despesas')
      .gte('date', effectiveStart)
      .lte('date', endDate)
      .order('date', { ascending: false });
    
    if (expError) throw expError;

    const totalExpense = (expenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const recognizedIncome = Math.min(totalExpense, Number(card.monthly_limit));
    const latestExpenseDate = expenses && expenses.length > 0 ? expenses[0].date : endDate;

    const { data: existingIncome, error: existError } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('fuel_card_id', card.id)
      .eq('auto_generated', true)
      .eq('macro_group', 'Rendimentos')
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(1);

    if (existError) throw existError;

    if (recognizedIncome <= 0) {
      if (existingIncome && existingIncome.length > 0) {
        await supabase.from('transactions').delete().eq('id', existingIncome[0].id);
      }
      continue;
    }

    const incomeTxData = {
      user_id: userId,
      date: latestExpenseDate,
      amount: recognizedIncome,
      macro_group: 'Rendimentos' as const,
      category_id: card.subcategories.category_id,
      subcategory_id: card.income_subcategory_id,
      fuel_card_id: card.id,
      auto_generated: true,
      notes: `${card.card_name} — rendimento automático`,
    };

    if (existingIncome && existingIncome.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .update({ amount: recognizedIncome, date: latestExpenseDate, notes: incomeTxData.notes })
        .eq('id', existingIncome[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('transactions').insert(incomeTxData);
      if (error) throw error;
    }
  }
}

/**
 * Get monthly card usage summary for dashboard display
 */
export async function getFuelCardMonthlySummary(
  userId: string,
  year: number,
  month: number
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const { data: cards, error: cardsError } = await supabase
    .from('fuel_cards')
    .select('*, subcategories(id, name)')
    .eq('user_id', userId)
    .order('card_name');
  if (cardsError) throw cardsError;

  const summaries = [];

  for (const card of cards || []) {
    if (card.effective_from > endDate) continue;
    if (card.effective_to && card.effective_to < startDate) continue;

    const effectiveStart = card.effective_from > startDate ? card.effective_from : startDate;

    // For one_time cards, get total spent since effective_from (all time)
    const isOneTime = card.limit_type === 'one_time';

    const { data: monthExpenses } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('fuel_card_id', card.id)
      .eq('macro_group', 'Despesas')
      .gte('date', effectiveStart)
      .lte('date', endDate);

    const totalSpentMonth = (monthExpenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

    let totalSpentAllTime = totalSpentMonth;
    if (isOneTime) {
      const { data: allExpenses } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('fuel_card_id', card.id)
        .eq('macro_group', 'Despesas')
        .gte('date', card.effective_from);
      totalSpentAllTime = (allExpenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
    }

    const limit = Number(card.monthly_limit);
    const recognized = isOneTime
      ? Math.min(totalSpentAllTime, limit)
      : Math.min(totalSpentMonth, limit);
    const remaining = isOneTime
      ? Math.max(0, limit - totalSpentAllTime)
      : Math.max(0, limit - totalSpentMonth);

    summaries.push({
      card,
      totalSpent: isOneTime ? totalSpentAllTime : totalSpentMonth,
      totalSpentMonth,
      recognized,
      remaining,
      monthlyLimit: limit,
      isExhausted: isOneTime && totalSpentAllTime >= limit,
    });
  }

  return summaries;
}
