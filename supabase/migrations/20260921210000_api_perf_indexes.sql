-- Indexes matching measured hot query patterns (staff notifications + org email lookup).
-- Do not add speculative combinations.

-- Staff in-app feed / unread window:
-- WHERE restaurant_id = ? AND audience = 'STAFF' AND channel = 'IN_APP'
-- ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS notifications_staff_in_app_created_idx
  ON public.notifications (restaurant_id, audience, channel, created_at DESC);

-- Duplicate customer email check:
-- WHERE organization_id = ? AND email = ?
CREATE INDEX IF NOT EXISTS customers_organization_email_idx
  ON public.customers (organization_id, email)
  WHERE email IS NOT NULL;
