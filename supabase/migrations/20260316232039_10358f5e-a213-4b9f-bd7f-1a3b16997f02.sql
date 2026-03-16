
-- Create a function that checks if two users are in a pending or accepted partnership
CREATE OR REPLACE FUNCTION public.is_partnership_member(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partnerships
    WHERE status IN ('pending', 'accepted')
    AND (
      (requester_id = _viewer_id AND target_id = _profile_user_id)
      OR (target_id = _viewer_id AND requester_id = _profile_user_id)
    )
  )
$$;

-- Update profiles SELECT policy to also allow viewing profiles of pending/accepted partners
DROP POLICY "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = get_partner_id(auth.uid())
    OR is_partnership_member(auth.uid(), user_id)
  );
