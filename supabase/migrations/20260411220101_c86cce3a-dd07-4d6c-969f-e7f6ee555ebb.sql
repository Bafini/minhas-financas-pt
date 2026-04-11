CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id = get_partner_id(auth.uid()));

CREATE POLICY "Users can insert own audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));

CREATE POLICY "Users can delete own audit_logs" ON public.audit_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (user_id = get_partner_id(auth.uid()) AND get_partner_permission(auth.uid()) = 'full'));

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);