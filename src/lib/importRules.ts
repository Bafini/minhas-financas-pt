import { supabase } from '@/integrations/supabase/client';
import { ParsedBankRow, BankSource } from './bankParsers';
import { MacroGroup } from './calculations';

export interface ImportRule {
  id: string;
  user_id: string;
  bank_source: string;          // 'all' | BankSource
  rule_type: 'categorize' | 'ignore';
  match_field: 'description' | 'description+sign' | 'description+amount';
  match_pattern: string;         // normalized
  category_id: string | null;
  subcategory_id: string | null;
  macro_group: MacroGroup | null;
  recurring_rule_id: string | null;
  priority: number;
  auto_learned: boolean;
  is_active: boolean;
  hit_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export function normalizeDescription(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')           // remove diacritics
    .replace(/\d{2}[-/.]\d{2}[-/.]\d{2,4}/g, '') // dates
    .replace(/\b\d{4,}\b/g, '')                // long numbers
    .replace(/[^\w\s]/g, ' ')                  // punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function ruleAppliesToBank(rule: ImportRule, bank: BankSource): boolean {
  return rule.bank_source === 'all' || rule.bank_source === bank;
}

export interface RuleMatch {
  rule: ImportRule;
}

export function findMatchingRule(
  row: ParsedBankRow,
  rules: ImportRule[]
): RuleMatch | null {
  const normRow = normalizeDescription(row.description);
  const sign = row.amount >= 0 ? '+' : '-';

  // Higher priority first; longer pattern first as tiebreak (more specific)
  const sorted = [...rules]
    .filter(r => r.is_active && ruleAppliesToBank(r, row.bankSource))
    .sort((a, b) => b.priority - a.priority || b.match_pattern.length - a.match_pattern.length);

  for (const rule of sorted) {
    const pattern = rule.match_pattern;
    if (!pattern) continue;

    if (rule.match_field === 'description+amount') {
      // Pattern format: "<normDesc>|=<amount>"
      const idx = pattern.lastIndexOf('|=');
      if (idx < 0) continue;
      const descPart = pattern.slice(0, idx);
      const amountPart = parseFloat(pattern.slice(idx + 2));
      if (!descPart || isNaN(amountPart)) continue;
      if (!normRow.includes(descPart)) continue;
      if (Math.abs(Math.abs(row.amount) - Math.abs(amountPart)) > 0.005) continue;
      return { rule };
    }

    if (rule.match_field === 'description+sign') {
      const ruleSign = pattern.endsWith('|+') ? '+' : pattern.endsWith('|-') ? '-' : null;
      const descPart = ruleSign ? pattern.slice(0, -2) : pattern;
      if (!normRow.includes(descPart)) continue;
      if (ruleSign && ruleSign !== sign) continue;
      return { rule };
    }

    if (!normRow.includes(pattern)) continue;
    return { rule };
  }
  return null;
}

export async function fetchImportRules(userId: string): Promise<ImportRule[]> {
  const { data, error } = await supabase
    .from('import_rules')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false });
  if (error) throw error;
  return (data || []) as ImportRule[];
}

/**
 * Create or update an auto-learned rule based on a confirmed manual choice.
 */
export async function learnCategorizeRule(
  userId: string,
  row: ParsedBankRow,
  categoryId: string | null,
  subcategoryId: string | null,
  macroGroup: MacroGroup | null,
  recurringRuleId: string | null = null,
  matchExactAmount: boolean = false
): Promise<void> {
  const baseDesc = normalizeDescription(row.description);
  if (!baseDesc || baseDesc.length < 3) return;

  const pattern = matchExactAmount ? `${baseDesc}|=${Math.abs(row.amount).toFixed(2)}` : baseDesc;
  const matchField = matchExactAmount ? 'description+amount' : 'description';
  const priority = matchExactAmount ? 150 : 100;

  const { data: existing } = await supabase
    .from('import_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('rule_type', 'categorize')
    .eq('match_pattern', pattern)
    .eq('match_field', matchField)
    .eq('bank_source', row.bankSource)
    .maybeSingle();

  if (existing) {
    await supabase.from('import_rules').update({
      category_id: categoryId,
      subcategory_id: subcategoryId,
      macro_group: macroGroup,
      recurring_rule_id: recurringRuleId,
      hit_count: (existing.hit_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabase.from('import_rules').insert({
      user_id: userId,
      bank_source: row.bankSource,
      rule_type: 'categorize',
      match_field: matchField,
      match_pattern: pattern,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      macro_group: macroGroup,
      recurring_rule_id: recurringRuleId,
      priority,
      auto_learned: true,
      hit_count: 1,
      last_used_at: new Date().toISOString(),
    });
  }
}

export async function createIgnoreRule(
  userId: string,
  bankSource: BankSource,
  pattern: string
): Promise<void> {
  const norm = normalizeDescription(pattern);
  if (!norm) return;
  await supabase.from('import_rules').insert({
    user_id: userId,
    bank_source: bankSource,
    rule_type: 'ignore',
    match_field: 'description',
    match_pattern: norm,
    priority: 200,
    auto_learned: false,
  });
}

export async function bumpRuleUsage(ruleIds: string[]): Promise<void> {
  if (ruleIds.length === 0) return;
  const now = new Date().toISOString();
  for (const id of ruleIds) {
    const { data } = await supabase.from('import_rules').select('hit_count').eq('id', id).maybeSingle();
    await supabase.from('import_rules').update({
      hit_count: ((data?.hit_count as number) || 0) + 1,
      last_used_at: now,
    }).eq('id', id);
  }
}
