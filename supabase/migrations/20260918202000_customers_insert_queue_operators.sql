-- Allow queue operators (including STAFF) to insert walk-in customers.
-- Edit/update remains manager+ via customers_update_manager_up.
-- The customers UI "New customer" button still requires customers.manage.

DROP POLICY IF EXISTS "customers_insert_manager_up" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_member" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_operator" ON public.customers;

CREATE POLICY "customers_insert_operator"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
    )
  );
