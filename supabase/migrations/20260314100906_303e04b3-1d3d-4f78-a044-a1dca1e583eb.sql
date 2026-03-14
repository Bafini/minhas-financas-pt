
-- Enums
CREATE TYPE public.macro_group AS ENUM ('Rendimentos', 'Investimentos', 'Despesas');
CREATE TYPE public.frequency_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'EUR',
  locale TEXT DEFAULT 'pt-PT',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_type public.macro_group NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- 3. Subcategories
CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subcategories" ON public.subcategories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subcategories" ON public.subcategories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subcategories" ON public.subcategories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subcategories" ON public.subcategories FOR DELETE USING (auth.uid() = user_id);

-- 4. Imports
CREATE TABLE public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INT DEFAULT 0,
  imported_rows INT DEFAULT 0,
  duplicate_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own imports" ON public.imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imports" ON public.imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own imports" ON public.imports FOR UPDATE USING (auth.uid() = user_id);

-- 5. Import Rows
CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  is_duplicate BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own import_rows" ON public.import_rows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own import_rows" ON public.import_rows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import_rows" ON public.import_rows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import_rows" ON public.import_rows FOR DELETE USING (auth.uid() = user_id);

-- 6. Event Labels
CREATE TABLE public.event_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.event_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own event_labels" ON public.event_labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own event_labels" ON public.event_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own event_labels" ON public.event_labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own event_labels" ON public.event_labels FOR DELETE USING (auth.uid() = user_id);

-- 7. Recurring Rules
CREATE TABLE public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  frequency public.frequency_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  category_id UUID REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  macro_group public.macro_group NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recurring_rules" ON public.recurring_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_rules" ON public.recurring_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_rules" ON public.recurring_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_rules" ON public.recurring_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_recurring_rules_updated_at BEFORE UPDATE ON public.recurring_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Transactions (Main Table)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  macro_group public.macro_group NOT NULL,
  import_id UUID REFERENCES public.imports(id),
  is_duplicate BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurring_rule_id UUID REFERENCES public.recurring_rules(id),
  event_label TEXT,
  is_extraordinary BOOLEAN DEFAULT false,
  exclude_from_kpis BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_event ON public.transactions(event_label);
CREATE INDEX idx_transactions_macro_group ON public.transactions(macro_group);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);

-- 9. Budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  amount DECIMAL(12,2) NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category_id, subcategory_id, month, year)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Saved Filters
CREATE TABLE public.saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved_filters" ON public.saved_filters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved_filters" ON public.saved_filters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved_filters" ON public.saved_filters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved_filters" ON public.saved_filters FOR DELETE USING (auth.uid() = user_id);
