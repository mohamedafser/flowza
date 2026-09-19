-- Phase 15: Dashboard & Analytics supporting indexes
-- Targeted indexes for date-range analytics queries already scoped by branch.

-- Queue entries are queried by queue_id + business_date range for analytics.
-- Existing idx covers (queue_id, business_date, status); add joined_at support
-- for peak-hour / volume series ordered scans within a business date window.
CREATE INDEX IF NOT EXISTS queue_entries_queue_business_joined_idx
  ON public.queue_entries (queue_id, business_date, joined_at);

-- Reservation analytics filter by branch + reservation_date range.
-- Existing (branch_id, reservation_date, status) covers most cases; add
-- covering support for date-ordered volume scans.
CREATE INDEX IF NOT EXISTS reservations_branch_date_created_idx
  ON public.reservations (branch_id, reservation_date, created_at);

-- Walk-in analytics read audit_logs by restaurant + action + created_at.
CREATE INDEX IF NOT EXISTS audit_logs_restaurant_action_created_idx
  ON public.audit_logs (restaurant_id, action, created_at DESC);

-- New customers in range: restaurant + created_at.
CREATE INDEX IF NOT EXISTS customers_restaurant_created_idx
  ON public.customers (restaurant_id, created_at DESC);
