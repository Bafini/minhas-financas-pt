-- 1. Restrict partnership member visibility to accepted partnerships only
CREATE OR REPLACE FUNCTION public.is_partnership_member(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.partnerships
    WHERE status = 'accepted'
    AND (
      (requester_id = _viewer_id AND target_id = _profile_user_id)
      OR (target_id = _viewer_id AND requester_id = _profile_user_id)
    )
  )
$function$;

-- 2. Deterministic partner resolution
CREATE OR REPLACE FUNCTION public.get_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN requester_id = _user_id THEN target_id ELSE requester_id END
  FROM public.partnerships
  WHERE status = 'accepted' AND (requester_id = _user_id OR target_id = _user_id)
  ORDER BY created_at ASC, id ASC
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_partner_permission(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN requester_id = _user_id THEN 'full' ELSE permission_level END
  FROM public.partnerships
  WHERE status = 'accepted' AND (requester_id = _user_id OR target_id = _user_id)
  ORDER BY created_at ASC, id ASC
  LIMIT 1
$function$;

-- 3. Audit logs: only the owner can write/delete their own trail
DROP POLICY IF EXISTS "Users can insert own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit_logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can delete own audit_logs"
ON public.audit_logs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 4. Revoke SECURITY DEFINER function execution from anonymous visitors
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_partner_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_partner_permission(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_partnership_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_permission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partnership_member(uuid, uuid) TO authenticated;