
CREATE TABLE IF NOT EXISTS public.import_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_source TEXT NOT NULL DEFAULT 'all',
  rule_type TEXT NOT NULL DEFAULT 'categorize',
  match_field TEXT NOT NULL DEFAULT 'description',
  match_pattern TEXT NOT NULL,
  category_id UUID,
  subcategory_id UUID,
  macro_group public.macro_group,
  priority INTEGER NOT NULL DEFAULT 100,
  auto_learned BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own import_rules" ON public.import_rules;
DROP POLICY IF EXISTS "Users can insert own import_rules" ON public.import_rules;
DROP POLICY IF EXISTS "Users can update own import_rules" ON public.import_rules;
DROP POLICY IF EXISTS "Users can delete own import_rules" ON public.import_rules;

CREATE POLICY "Users can view own import_rules" ON public.import_rules FOR SELECT
  USING ((auth.uid() = user_id) OR (user_id = get_partner_id(auth.uid())));
CREATE POLICY "Users can insert own import_rules" ON public.import_rules FOR INSERT
  WITH CHECK ((auth.uid() = user_id) OR ((user_id = get_partner_id(auth.uid())) AND (get_partner_permission(auth.uid()) = 'full'::text)));
CREATE POLICY "Users can update own import_rules" ON public.import_rules FOR UPDATE
  USING ((auth.uid() = user_id) OR ((user_id = get_partner_id(auth.uid())) AND (get_partner_permission(auth.uid()) = 'full'::text)));
CREATE POLICY "Users can delete own import_rules" ON public.import_rules FOR DELETE
  USING ((auth.uid() = user_id) OR ((user_id = get_partner_id(auth.uid())) AND (get_partner_permission(auth.uid()) = 'full'::text)));

DROP TRIGGER IF EXISTS update_import_rules_updated_at ON public.import_rules;
CREATE TRIGGER update_import_rules_updated_at BEFORE UPDATE ON public.import_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_import_rules_user_active ON public.import_rules(user_id, is_active, priority DESC);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_source TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_transactions_bank_dedup ON public.transactions(user_id, bank_source, date, amount);

ALTER TABLE public.imports ADD COLUMN IF NOT EXISTS bank_source TEXT;
