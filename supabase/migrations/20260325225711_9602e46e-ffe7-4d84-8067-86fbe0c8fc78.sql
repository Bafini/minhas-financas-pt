
-- Add card_type to fuel_cards
ALTER TABLE public.fuel_cards ADD COLUMN card_type text NOT NULL DEFAULT 'combustivel';

-- Add movements_updated_until to profiles
ALTER TABLE public.profiles ADD COLUMN movements_updated_until date;

-- Junction table: which expense subcategories each card covers
CREATE TABLE public.card_expense_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.fuel_cards(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, subcategory_id)
);

ALTER TABLE public.card_expense_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own card_expense_subcategories" ON public.card_expense_subcategories
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id = get_partner_id(auth.uid()));

CREATE POLICY "Users can insert own card_expense_subcategories" ON public.card_expense_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));

CREATE POLICY "Users can delete own card_expense_subcategories" ON public.card_expense_subcategories
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));

CREATE POLICY "Users can update own card_expense_subcategories" ON public.card_expense_subcategories
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));
