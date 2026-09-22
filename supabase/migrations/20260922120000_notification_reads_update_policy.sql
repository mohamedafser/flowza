-- Allow staff to refresh their own read receipts (upsert / re-mark).
-- Previous policies covered SELECT / INSERT / DELETE only; upsert on an
-- existing row requires UPDATE and silently failed under RLS.

DROP POLICY IF EXISTS "notification_reads_update_own" ON public.notification_reads;
CREATE POLICY "notification_reads_update_own"
  ON public.notification_reads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_restaurant_member(
      (
        SELECT n.restaurant_id
        FROM public.notifications n
        WHERE n.id = notification_id
      )
    )
  );
