-- Phase 7: customer management constraints, lookup index, and tighter RLS.
-- Customers remain restaurant-scoped. Phone/email are not globally unique.

-- ---------------------------------------------------------------------------
-- Data integrity (application still validates email/phone format)
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD CONSTRAINT customers_name_not_blank
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 120);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_phone_not_blank
  CHECK (phone IS NULL OR char_length(btrim(phone)) > 0);

ALTER TABLE public.customers
  ADD CONSTRAINT customers_email_not_blank
  CHECK (email IS NULL OR char_length(btrim(email)) > 0);

CREATE INDEX IF NOT EXISTS customers_created_at_idx
  ON public.customers (restaurant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: members can view; OWNER/ADMIN/MANAGER can insert/update
-- (matches customers.view / customers.manage). Tenant isolation unchanged.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers_insert_member" ON public.customers;
DROP POLICY IF EXISTS "customers_update_member" ON public.customers;

CREATE POLICY "customers_insert_manager_up"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "customers_update_manager_up"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );
