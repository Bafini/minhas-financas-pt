
-- Update INSERT policies to allow partners with 'full' permission to insert on behalf of partner
-- Tables: transactions, categories, subcategories, budgets, recurring_rules, event_labels, fuel_cards, imports, import_rows, saved_filters

DROP POLICY "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own subcategories" ON public.subcategories;
CREATE POLICY "Users can insert own subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own budgets" ON public.budgets;
CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own recurring_rules" ON public.recurring_rules;
CREATE POLICY "Users can insert own recurring_rules" ON public.recurring_rules
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own event_labels" ON public.event_labels;
CREATE POLICY "Users can insert own event_labels" ON public.event_labels
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own fuel_cards" ON public.fuel_cards;
CREATE POLICY "Users can insert own fuel_cards" ON public.fuel_cards
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own imports" ON public.imports;
CREATE POLICY "Users can insert own imports" ON public.imports
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own import_rows" ON public.import_rows;
CREATE POLICY "Users can insert own import_rows" ON public.import_rows
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );

DROP POLICY "Users can insert own saved_filters" ON public.saved_filters;
CREATE POLICY "Users can insert own saved_filters" ON public.saved_filters
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full')
  );
