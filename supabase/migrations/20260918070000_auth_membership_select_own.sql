-- Phase 3: allow members to read their own membership rows (incl. INVITED)
-- without weakening tenant isolation for other restaurants' data.

CREATE POLICY "restaurant_members_select_own"
  ON public.restaurant_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
