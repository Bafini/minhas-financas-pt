import { supabase } from '@/integrations/supabase/client';

export interface FuelCard {
  id: string;
  user_id: string;
  card_name: string;
  monthly_limit: number;
  income_subcategory_id: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  subcategories?: { id: string; name: string; category_id: string } | null;
}

export async function fetchFuelCards(userId: string): Promise<FuelCard[]> {
  const { data, error } = await supabase
    .from('fuel_cards')
    .select('*, subcategories(id, name, category_id)')
    .eq('user_id', userId)
    .order('card_name');
  if (error) throw error;
  return (data || []) as FuelCard[];
}

/**
 * Recalculates fuel card income transactions for a given month/year.
 * - Sums all fuel expenses linked to each card in that month
 * - Creates/updates a single auto-generated income transaction per card per month
 * - Caps income at the card's monthly_limit
 */
export async function recalculateFuelCardIncome(
  userId: string,
  year: number,
  month: number, // 1-based
  fuelCardId?: string
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  // Get relevant fuel cards
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

    // Check card is effective for this month
    if (card.effective_from > endDate) continue;
    if (card.effective_to && card.effective_to < startDate) continue;

    // Sum fuel expenses for this card in this month
    const { data: expenses, error: expError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('fuel_card_id', card.id)
      .eq('macro_group', 'Despesas')
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (expError) throw expError;

    const totalExpense = (expenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const recognizedIncome = Math.min(totalExpense, Number(card.monthly_limit));

    // Find existing auto-generated income transaction for this card/month
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
      // Delete existing income tx if no eligible expenses
      if (existingIncome && existingIncome.length > 0) {
        await supabase.from('transactions').delete().eq('id', existingIncome[0].id);
      }
      continue;
    }

    const incomeTxData = {
      user_id: userId,
      date: endDate, // Last day of the month
      amount: recognizedIncome,
      macro_group: 'Rendimentos' as const,
      category_id: card.subcategories.category_id,
      subcategory_id: card.income_subcategory_id,
      fuel_card_id: card.id,
      auto_generated: true,
      notes: `Cartão ${card.card_name} — rendimento automático`,
    };

    if (existingIncome && existingIncome.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .update({ amount: recognizedIncome, date: endDate, notes: incomeTxData.notes })
        .eq('id', existingIncome[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('transactions').insert(incomeTxData);
      if (error) throw error;
    }
  }
}

/**
 * Get monthly fuel card usage summary for dashboard display
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
    // Skip cards not effective for this month
    if (card.effective_from > endDate) continue;
    if (card.effective_to && card.effective_to < startDate) continue;

    // Clamp start date to card's effective_from
    const effectiveStart = card.effective_from > startDate ? card.effective_from : startDate;

    // Sum expenses from effective start
    const { data: expenses } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('fuel_card_id', card.id)
      .eq('macro_group', 'Despesas')
      .gte('date', effectiveStart)
      .lte('date', endDate);

    const totalSpent = (expenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
    const recognized = Math.min(totalSpent, Number(card.monthly_limit));
    const remaining = Math.max(0, Number(card.monthly_limit) - totalSpent);

    summaries.push({
      card,
      totalSpent,
      recognized,
      remaining,
      monthlyLimit: Number(card.monthly_limit),
    });
  }

  return summaries;
}
