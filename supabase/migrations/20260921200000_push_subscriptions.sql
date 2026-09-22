-- Web Push subscriptions for staff and customers.
-- PUSH is a delivery channel alongside EMAIL / SMS / WHATSAPP / IN_APP.

DO $$
BEGIN
  ALTER TYPE public.notification_channel ADD VALUE IF NOT EXISTS 'PUSH';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  audience text NOT NULL,
  user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  expiration_time timestamptz,
  user_agent text,
  click_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT push_subscriptions_audience_check
    CHECK (audience IN ('STAFF', 'CUSTOMER')),
  CONSTRAINT push_subscriptions_staff_owner_check
    CHECK (
      (audience = 'STAFF' AND user_id IS NOT NULL)
      OR (audience = 'CUSTOMER' AND customer_id IS NOT NULL)
    ),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_staff_lookup_idx
  ON public.push_subscriptions (restaurant_id, user_id)
  WHERE audience = 'STAFF';

CREATE INDEX IF NOT EXISTS push_subscriptions_customer_lookup_idx
  ON public.push_subscriptions (customer_id)
  WHERE audience = 'CUSTOMER';

CREATE INDEX IF NOT EXISTS push_subscriptions_restaurant_idx
  ON public.push_subscriptions (restaurant_id, audience);

DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at
  ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Keep organization_id in sync with restaurant (same pattern as other tables).
CREATE OR REPLACE FUNCTION public.push_subscriptions_set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT r.organization_id INTO NEW.organization_id
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_set_organization_id
  ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.push_subscriptions_set_organization_id();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Staff can see/manage their own device subscriptions.
DROP POLICY IF EXISTS "push_subscriptions_select_own_staff"
  ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own_staff"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    audience = 'STAFF'
    AND user_id = auth.uid()
    AND public.is_restaurant_member(restaurant_id)
  );

DROP POLICY IF EXISTS "push_subscriptions_insert_own_staff"
  ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own_staff"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    audience = 'STAFF'
    AND user_id = auth.uid()
    AND public.is_restaurant_member(restaurant_id)
  );

DROP POLICY IF EXISTS "push_subscriptions_update_own_staff"
  ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own_staff"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    audience = 'STAFF'
    AND user_id = auth.uid()
    AND public.is_restaurant_member(restaurant_id)
  )
  WITH CHECK (
    audience = 'STAFF'
    AND user_id = auth.uid()
    AND public.is_restaurant_member(restaurant_id)
  );

DROP POLICY IF EXISTS "push_subscriptions_delete_own_staff"
  ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own_staff"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    audience = 'STAFF'
    AND user_id = auth.uid()
    AND public.is_restaurant_member(restaurant_id)
  );

-- Customer subscriptions are managed via service role + access-token APIs.
-- Authenticated members can still read customer device counts for support.
DROP POLICY IF EXISTS "push_subscriptions_select_member_customer"
  ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_member_customer"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    audience = 'CUSTOMER'
    AND public.is_restaurant_member(restaurant_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
