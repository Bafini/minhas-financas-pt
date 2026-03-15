
-- Create fuel_cards table
CREATE TABLE public.fuel_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_name TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL,
  income_subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.fuel_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fuel_cards" ON public.fuel_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fuel_cards" ON public.fuel_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fuel_cards" ON public.fuel_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fuel_cards" ON public.fuel_cards FOR DELETE USING (auth.uid() = user_id);

-- Add fuel_card_id, linked_transaction_id, auto_generated to transactions
ALTER TABLE public.transactions ADD COLUMN fuel_card_id UUID REFERENCES public.fuel_cards(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN auto_generated BOOLEAN DEFAULT false;
