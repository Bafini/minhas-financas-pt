import { supabase } from '@/integrations/supabase/client';
import { MacroGroup } from '@/lib/calculations';

export interface TransactionRow {
  id: string;
  user_id: string;
  date: string;
  category_id: string | null;
  subcategory_id: string | null;
  amount: number;
  notes: string | null;
  macro_group: MacroGroup;
  import_id: string | null;
  is_duplicate: boolean | null;
  is_recurring: boolean | null;
  recurring_rule_id: string | null;
  event_label: string | null;
  is_extraordinary: boolean | null;
  exclude_from_kpis: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  categories?: { id: string; name: string; group_type: MacroGroup } | null;
  subcategories?: { id: string; name: string } | null;
}

export async function fetchTransactions(
  userId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    macroGroup?: MacroGroup;
    categoryId?: string;
    subcategoryId?: string;
    search?: string;
    eventLabel?: string;
    page?: number;
    pageSize?: number;
  }
) {
  let query = supabase
    .from('transactions')
    .select('*, categories(id, name, group_type), subcategories(id, name)', { count: 'exact' })
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (filters?.startDate) query = query.gte('date', filters.startDate);
  if (filters?.endDate) query = query.lte('date', filters.endDate);
  if (filters?.macroGroup) query = query.eq('macro_group', filters.macroGroup);
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters?.subcategoryId) query = query.eq('subcategory_id', filters.subcategoryId);
  if (filters?.eventLabel) query = query.eq('event_label', filters.eventLabel);
  if (filters?.search) query = query.ilike('notes', `%${filters.search}%`);

  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 50;
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as TransactionRow[], count: count ?? 0 };
}

export async function fetchCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('user_id', userId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchBudgets(userId: string, month: number, year: number) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*, categories(id, name, group_type), subcategories(id, name)')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year);
  if (error) throw error;
  return data;
}

export async function fetchRecurringRules(userId: string) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*, categories(id, name, group_type), subcategories(id, name)')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchEventLabels(userId: string) {
  const { data, error } = await supabase
    .from('event_labels')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchImports(userId: string) {
  const { data, error } = await supabase
    .from('imports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
