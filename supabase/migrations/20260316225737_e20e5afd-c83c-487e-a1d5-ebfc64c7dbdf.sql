
-- Create partnerships table
CREATE TABLE public.partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_email text NOT NULL,
  target_id uuid,
  status text NOT NULL DEFAULT 'pending',
  permission_level text NOT NULL DEFAULT 'read',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

-- RLS for partnerships
CREATE POLICY "Users can view own partnerships" ON public.partnerships
FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users can insert partnerships" ON public.partnerships
FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update relevant partnerships" ON public.partnerships
FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users can delete own partnerships" ON public.partnerships
FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Security definer: get partner user_id
CREATE OR REPLACE FUNCTION public.get_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN requester_id = _user_id THEN target_id ELSE requester_id END
  FROM public.partnerships
  WHERE status = 'accepted' AND (requester_id = _user_id OR target_id = _user_id)
  LIMIT 1
$$;

-- Security definer: get partner permission for the calling user
CREATE OR REPLACE FUNCTION public.get_partner_permission(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN requester_id = _user_id THEN 'full' ELSE permission_level END
  FROM public.partnerships
  WHERE status = 'accepted' AND (requester_id = _user_id OR target_id = _user_id)
  LIMIT 1
$$;

-- Security definer: find user by email (accesses auth.users)
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = lower(_email) LIMIT 1
$$;

-- Validation trigger: max 1 active/pending partnership per user
CREATE OR REPLACE FUNCTION public.validate_partnership_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending', 'accepted') THEN
    IF EXISTS (
      SELECT 1 FROM public.partnerships
      WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status IN ('pending', 'accepted')
      AND (requester_id = NEW.requester_id OR target_id = NEW.requester_id
        OR (NEW.target_id IS NOT NULL AND (requester_id = NEW.target_id OR target_id = NEW.target_id)))
    ) THEN
      RAISE EXCEPTION 'User already has an active or pending partnership';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_partnership_limit_trigger
BEFORE INSERT OR UPDATE ON public.partnerships
FOR EACH ROW EXECUTE FUNCTION public.validate_partnership_limit();

-- Now update RLS policies on all data tables to allow partner access

-- BUDGETS
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
CREATE POLICY "Users can view own budgets" ON public.budgets
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets" ON public.budgets
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;
CREATE POLICY "Users can delete own budgets" ON public.budgets
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
CREATE POLICY "Users can view own categories" ON public.categories
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories" ON public.categories
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- EVENT_LABELS
DROP POLICY IF EXISTS "Users can view own event_labels" ON public.event_labels;
CREATE POLICY "Users can view own event_labels" ON public.event_labels
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own event_labels" ON public.event_labels;
CREATE POLICY "Users can update own event_labels" ON public.event_labels
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own event_labels" ON public.event_labels;
CREATE POLICY "Users can delete own event_labels" ON public.event_labels
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- FUEL_CARDS
DROP POLICY IF EXISTS "Users can view own fuel_cards" ON public.fuel_cards;
CREATE POLICY "Users can view own fuel_cards" ON public.fuel_cards
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own fuel_cards" ON public.fuel_cards;
CREATE POLICY "Users can update own fuel_cards" ON public.fuel_cards
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own fuel_cards" ON public.fuel_cards;
CREATE POLICY "Users can delete own fuel_cards" ON public.fuel_cards
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- IMPORT_ROWS
DROP POLICY IF EXISTS "Users can view own import_rows" ON public.import_rows;
CREATE POLICY "Users can view own import_rows" ON public.import_rows
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own import_rows" ON public.import_rows;
CREATE POLICY "Users can update own import_rows" ON public.import_rows
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own import_rows" ON public.import_rows;
CREATE POLICY "Users can delete own import_rows" ON public.import_rows
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- IMPORTS
DROP POLICY IF EXISTS "Users can view own imports" ON public.imports;
CREATE POLICY "Users can view own imports" ON public.imports
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own imports" ON public.imports;
CREATE POLICY "Users can update own imports" ON public.imports
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

-- RECURRING_RULES
DROP POLICY IF EXISTS "Users can view own recurring_rules" ON public.recurring_rules;
CREATE POLICY "Users can view own recurring_rules" ON public.recurring_rules
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own recurring_rules" ON public.recurring_rules;
CREATE POLICY "Users can update own recurring_rules" ON public.recurring_rules
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own recurring_rules" ON public.recurring_rules;
CREATE POLICY "Users can delete own recurring_rules" ON public.recurring_rules
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- SAVED_FILTERS
DROP POLICY IF EXISTS "Users can view own saved_filters" ON public.saved_filters;
CREATE POLICY "Users can view own saved_filters" ON public.saved_filters
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own saved_filters" ON public.saved_filters;
CREATE POLICY "Users can update own saved_filters" ON public.saved_filters
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own saved_filters" ON public.saved_filters;
CREATE POLICY "Users can delete own saved_filters" ON public.saved_filters
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- SUBCATEGORIES
DROP POLICY IF EXISTS "Users can view own subcategories" ON public.subcategories;
CREATE POLICY "Users can view own subcategories" ON public.subcategories
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own subcategories" ON public.subcategories;
CREATE POLICY "Users can update own subcategories" ON public.subcategories
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own subcategories" ON public.subcategories;
CREATE POLICY "Users can delete own subcategories" ON public.subcategories
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

-- TRANSACTIONS
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
FOR SELECT USING (auth.uid() = user_id OR user_id = public.get_partner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions
FOR UPDATE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions" ON public.transactions
FOR DELETE USING (auth.uid() = user_id OR (user_id = public.get_partner_id(auth.uid()) AND public.get_partner_permission(auth.uid()) = 'full'));
