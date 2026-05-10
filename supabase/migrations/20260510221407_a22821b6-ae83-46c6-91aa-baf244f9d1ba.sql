CREATE TABLE public.bank_update_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  bank_source text NOT NULL,
  last_date date NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, bank_source)
);

ALTER TABLE public.bank_update_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank_update_dates"
ON public.bank_update_dates FOR SELECT
USING ((auth.uid() = user_id) OR (user_id = get_partner_id(auth.uid())));

CREATE POLICY "Users can insert own bank_update_dates"
ON public.bank_update_dates FOR INSERT
WITH CHECK ((auth.uid() = user_id) OR ((user_id = get_partner_id(auth.uid())) AND (get_partner_permission(auth.uid()) = 'full'::text)));

CREATE POLICY "Users can update own bank_update_dates"
ON public.bank_update_dates FOR UPDATE
USING ((auth.uid() = user_id) OR ((user_id = get_partner_id(auth.uid())) AND (get_partner_permission(auth.uid()) = 'full'::text)));

CREATE POLICY "Users can delete own bank_update_dates"
ON public.bank_update_dates FOR DELETE
USING ((auth.uid() = user_id) OR ((user_id = get_partner_id(auth.uid())) AND (get_partner_permission(auth.uid()) = 'full'::text)));

CREATE TRIGGER update_bank_update_dates_updated_at
BEFORE UPDATE ON public.bank_update_dates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();