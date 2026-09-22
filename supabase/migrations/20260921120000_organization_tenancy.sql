-- Flowza multi-tenant foundation: Organization as the primary tenant boundary.
-- Existing restaurants become organization-owned business profiles (1:1 initially).
-- Migrated organization IDs match restaurant IDs so restaurant_id === organization_id
-- for all pre-existing data (safe, reversible association; no orphan rows).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.organization_business_type AS ENUM (
  'RESTAURANT',
  'SALON',
  'CLINIC',
  'CAR_SERVICE',
  'OTHER'
);

CREATE TYPE public.organization_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);

CREATE TYPE public.billing_cycle AS ENUM (
  'MONTHLY',
  'YEARLY'
);

-- ---------------------------------------------------------------------------
-- Organizations (tenant root)
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_type public.organization_business_type NOT NULL DEFAULT 'RESTAURANT',
  status public.organization_status NOT NULL DEFAULT 'ACTIVE',
  plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX organizations_status_idx
  ON public.organizations (status);

CREATE INDEX organizations_business_type_idx
  ON public.organizations (business_type);

-- Backfill one organization per existing restaurant (same UUID).
INSERT INTO public.organizations (id, name, business_type, status, created_at, updated_at)
SELECT
  r.id,
  r.name,
  'RESTAURANT'::public.organization_business_type,
  CASE r.status
    WHEN 'ACTIVE'::public.restaurant_status THEN 'ACTIVE'::public.organization_status
    WHEN 'INACTIVE'::public.restaurant_status THEN 'INACTIVE'::public.organization_status
    WHEN 'SUSPENDED'::public.restaurant_status THEN 'SUSPENDED'::public.organization_status
  END,
  r.created_at,
  r.updated_at
FROM public.restaurants r
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Plans (global catalog) + org-owned subscriptions / payments
-- ---------------------------------------------------------------------------
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'MONTHLY',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT plans_price_non_negative CHECK (price >= 0),
  CONSTRAINT plans_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT plans_features_object CHECK (jsonb_typeof(features) = 'object'),
  CONSTRAINT plans_name_unique UNIQUE (name)
);

CREATE TRIGGER plans_set_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES public.plans (id) ON DELETE SET NULL;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  subscription_id uuid,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'PENDING',
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payments_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT payments_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX payments_organization_id_idx
  ON public.payments (organization_id);

CREATE INDEX payments_organization_status_idx
  ON public.payments (organization_id, status);

-- ---------------------------------------------------------------------------
-- Link restaurants → organizations (1:1 initially)
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT;

UPDATE public.restaurants
SET organization_id = id
WHERE organization_id IS NULL;

ALTER TABLE public.restaurants
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_organization_id_unique UNIQUE (organization_id);

CREATE INDEX restaurants_organization_id_idx
  ON public.restaurants (organization_id);

-- ---------------------------------------------------------------------------
-- Helper: resolve organization_id from a restaurant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organization_id_for_restaurant(p_restaurant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.restaurants
  WHERE id = p_restaurant_id;
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    INNER JOIN public.restaurants r ON r.id = rm.restaurant_id
    WHERE r.organization_id = p_organization_id
      AND rm.user_id = auth.uid()
      AND rm.status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_organization_role(
  p_organization_id uuid,
  p_roles public.member_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    INNER JOIN public.restaurants r ON r.id = rm.restaurant_id
    WHERE r.organization_id = p_organization_id
      AND rm.user_id = auth.uid()
      AND rm.status = 'ACTIVE'
      AND rm.role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.organization_id_for_restaurant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_organization_role(uuid, public.member_role[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.organization_id_for_restaurant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, public.member_role[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Add organization_id to tenant-owned tables that already have restaurant_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_members
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.branches
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.customers
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.customer_notification_preferences
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.restaurant_settings
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.operating_hours
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.special_hours
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

-- Denormalized org ownership for branch-scoped resources
ALTER TABLE public.queues
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.queue_entries
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.queue_events
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.displays
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.qr_codes
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.reservations
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.table_sections
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.restaurant_tables
  ADD COLUMN organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill organization_id
-- ---------------------------------------------------------------------------
UPDATE public.restaurant_members rm
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE rm.restaurant_id = r.id
  AND rm.organization_id IS NULL;

UPDATE public.branches b
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE b.restaurant_id = r.id
  AND b.organization_id IS NULL;

UPDATE public.customers c
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE c.restaurant_id = r.id
  AND c.organization_id IS NULL;

UPDATE public.notifications n
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE n.restaurant_id = r.id
  AND n.organization_id IS NULL;

UPDATE public.customer_notification_preferences p
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE p.restaurant_id = r.id
  AND p.organization_id IS NULL;

UPDATE public.subscriptions s
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE s.restaurant_id = r.id
  AND s.organization_id IS NULL;

UPDATE public.audit_logs a
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE a.restaurant_id = r.id
  AND a.organization_id IS NULL;

UPDATE public.restaurant_settings rs
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE rs.restaurant_id = r.id
  AND rs.organization_id IS NULL;

UPDATE public.operating_hours oh
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE oh.restaurant_id = r.id
  AND oh.organization_id IS NULL;

UPDATE public.special_hours sh
SET organization_id = r.organization_id
FROM public.restaurants r
WHERE sh.restaurant_id = r.id
  AND sh.organization_id IS NULL;

UPDATE public.queues q
SET organization_id = b.organization_id
FROM public.branches b
WHERE q.branch_id = b.id
  AND q.organization_id IS NULL;

UPDATE public.queue_entries qe
SET organization_id = q.organization_id
FROM public.queues q
WHERE qe.queue_id = q.id
  AND qe.organization_id IS NULL;

UPDATE public.queue_events qev
SET organization_id = qe.organization_id
FROM public.queue_entries qe
WHERE qev.queue_entry_id = qe.id
  AND qev.organization_id IS NULL;

UPDATE public.displays d
SET organization_id = b.organization_id
FROM public.branches b
WHERE d.branch_id = b.id
  AND d.organization_id IS NULL;

UPDATE public.qr_codes qr
SET organization_id = b.organization_id
FROM public.branches b
WHERE qr.branch_id = b.id
  AND qr.organization_id IS NULL;

UPDATE public.reservations res
SET organization_id = b.organization_id
FROM public.branches b
WHERE res.branch_id = b.id
  AND res.organization_id IS NULL;

UPDATE public.table_sections ts
SET organization_id = b.organization_id
FROM public.branches b
WHERE ts.branch_id = b.id
  AND ts.organization_id IS NULL;

UPDATE public.restaurant_tables rt
SET organization_id = b.organization_id
FROM public.branches b
WHERE rt.branch_id = b.id
  AND rt.organization_id IS NULL;

-- Require organization_id on tenant-owned tables
ALTER TABLE public.restaurant_members ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.customer_notification_preferences ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operating_hours ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.special_hours ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.queues ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.queue_entries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.queue_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.displays ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.qr_codes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.table_sections ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.restaurant_tables ALTER COLUMN organization_id SET NOT NULL;

-- Subscriptions: organization is the paying tenant (keep restaurant_id for legacy rows)
ALTER TABLE public.subscriptions
  ADD COLUMN plan_id uuid REFERENCES public.plans (id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Tenant-scoped uniqueness: phone unique per organization (not globally)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.customers_restaurant_phone_unique;
DROP INDEX IF EXISTS public.customers_phone_unique_per_restaurant;

-- Prefer organization-scoped uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS customers_organization_phone_unique
  ON public.customers (organization_id, phone)
  WHERE phone IS NOT NULL;

-- Keep restaurant+phone uniqueness while 1:1 org↔restaurant holds.
CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_phone_unique
  ON public.customers (restaurant_id, phone)
  WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Indexes for common tenant-scoped queries
-- ---------------------------------------------------------------------------
CREATE INDEX restaurant_members_organization_id_idx
  ON public.restaurant_members (organization_id);

CREATE INDEX restaurant_members_organization_user_idx
  ON public.restaurant_members (organization_id, user_id)
  WHERE status = 'ACTIVE';

CREATE INDEX branches_organization_id_idx
  ON public.branches (organization_id);

CREATE INDEX customers_organization_id_idx
  ON public.customers (organization_id);

CREATE INDEX customers_organization_phone_idx
  ON public.customers (organization_id, phone);

CREATE INDEX customers_organization_created_at_idx
  ON public.customers (organization_id, created_at DESC);

CREATE INDEX queues_organization_id_idx
  ON public.queues (organization_id);

CREATE INDEX queues_organization_status_idx
  ON public.queues (organization_id, status);

CREATE INDEX queue_entries_organization_id_idx
  ON public.queue_entries (organization_id);

CREATE INDEX queue_entries_organization_status_idx
  ON public.queue_entries (organization_id, status);

CREATE INDEX notifications_organization_id_idx
  ON public.notifications (organization_id);

CREATE INDEX subscriptions_organization_id_idx
  ON public.subscriptions (organization_id);

CREATE INDEX subscriptions_organization_status_idx
  ON public.subscriptions (organization_id, status);

CREATE INDEX audit_logs_organization_id_idx
  ON public.audit_logs (organization_id);

CREATE INDEX audit_logs_organization_created_at_idx
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX reservations_organization_id_idx
  ON public.reservations (organization_id);

CREATE INDEX displays_organization_id_idx
  ON public.displays (organization_id);

CREATE INDEX qr_codes_organization_id_idx
  ON public.qr_codes (organization_id);

CREATE INDEX restaurant_tables_organization_id_idx
  ON public.restaurant_tables (organization_id);

-- ---------------------------------------------------------------------------
-- Sync triggers: keep organization_id consistent with restaurant/branch parents
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_organization_id_from_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM public.restaurants
  WHERE id = NEW.restaurant_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'restaurant % has no organization', NEW.restaurant_id;
  END IF;

  NEW.organization_id := v_organization_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_id_from_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'branch % has no organization', NEW.branch_id;
  END IF;

  NEW.organization_id := v_organization_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_id_from_queue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM public.queues
  WHERE id = NEW.queue_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'queue % has no organization', NEW.queue_id;
  END IF;

  NEW.organization_id := v_organization_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_id_from_queue_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM public.queue_entries
  WHERE id = NEW.queue_entry_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'queue entry % has no organization', NEW.queue_entry_id;
  END IF;

  NEW.organization_id := v_organization_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_members_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.restaurant_members
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER branches_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER customers_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER notifications_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER customer_notification_preferences_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.customer_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER subscriptions_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER audit_logs_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER restaurant_settings_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.restaurant_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER operating_hours_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.operating_hours
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER special_hours_set_organization_id
BEFORE INSERT OR UPDATE OF restaurant_id ON public.special_hours
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_restaurant();

CREATE TRIGGER queues_set_organization_id
BEFORE INSERT OR UPDATE OF branch_id ON public.queues
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_branch();

CREATE TRIGGER queue_entries_set_organization_id
BEFORE INSERT OR UPDATE OF queue_id ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_queue();

CREATE TRIGGER queue_events_set_organization_id
BEFORE INSERT OR UPDATE OF queue_entry_id ON public.queue_events
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_queue_entry();

CREATE TRIGGER displays_set_organization_id
BEFORE INSERT OR UPDATE OF branch_id ON public.displays
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_branch();

CREATE TRIGGER qr_codes_set_organization_id
BEFORE INSERT OR UPDATE OF branch_id ON public.qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_branch();

CREATE TRIGGER reservations_set_organization_id
BEFORE INSERT OR UPDATE OF branch_id ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_branch();

CREATE TRIGGER table_sections_set_organization_id
BEFORE INSERT OR UPDATE OF branch_id ON public.table_sections
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_branch();

CREATE TRIGGER restaurant_tables_set_organization_id
BEFORE INSERT OR UPDATE OF branch_id ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_branch();

-- Cross-tenant integrity: customer must share organization with queue/branch
CREATE OR REPLACE FUNCTION public.enforce_customer_restaurant_for_queue_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  entry_organization_id uuid;
  customer_organization_id uuid;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT q.organization_id INTO entry_organization_id
  FROM public.queues q
  WHERE q.id = NEW.queue_id;

  SELECT c.organization_id INTO customer_organization_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF entry_organization_id IS NULL OR customer_organization_id IS NULL THEN
    RAISE EXCEPTION 'queue entry or customer not found for tenant check';
  END IF;

  IF entry_organization_id <> customer_organization_id THEN
    RAISE EXCEPTION 'customer must belong to the same organization as the queue';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_customer_restaurant_for_reservation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reservation_organization_id uuid;
  customer_organization_id uuid;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.organization_id INTO reservation_organization_id
  FROM public.branches b
  WHERE b.id = NEW.branch_id;

  SELECT c.organization_id INTO customer_organization_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF reservation_organization_id IS NULL OR customer_organization_id IS NULL THEN
    RAISE EXCEPTION 'reservation or customer not found for tenant check';
  END IF;

  IF reservation_organization_id <> customer_organization_id THEN
    RAISE EXCEPTION 'customer must belong to the same organization as the branch';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding: create organization + restaurant + OWNER membership
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_restaurant_with_owner(
  text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_name text,
  p_slug text,
  p_email text,
  p_phone text,
  p_website text,
  p_description text,
  p_timezone text,
  p_business_type public.organization_business_type DEFAULT 'RESTAURANT'
)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_restaurant public.restaurants;
  v_organization_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.*
  INTO v_restaurant
  FROM public.restaurants r
  INNER JOIN public.restaurant_members rm
    ON rm.restaurant_id = r.id
  WHERE rm.user_id = v_user_id
    AND rm.status = 'ACTIVE'
  ORDER BY rm.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_restaurant;
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (name, business_type, status)
  VALUES (
    p_name,
    COALESCE(p_business_type, 'RESTAURANT'::public.organization_business_type),
    'ACTIVE'::public.organization_status
  )
  RETURNING id INTO v_organization_id;

  INSERT INTO public.restaurants (
    name,
    slug,
    email,
    phone,
    website,
    description,
    timezone,
    status,
    organization_id
  )
  VALUES (
    p_name,
    p_slug,
    p_email,
    p_phone,
    p_website,
    p_description,
    p_timezone,
    'ACTIVE',
    v_organization_id
  )
  RETURNING * INTO v_restaurant;

  INSERT INTO public.restaurant_members (
    restaurant_id,
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_restaurant.id,
    v_organization_id,
    v_user_id,
    'OWNER',
    'ACTIVE'
  );

  RETURN v_restaurant;
END;
$$;

REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, public.organization_business_type
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, public.organization_business_type
) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS for organizations, plans, payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_member"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(id));

CREATE POLICY "organizations_update_owner_admin"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.has_organization_role(
      id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_organization_role(
      id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- Inserts happen via SECURITY DEFINER onboarding RPC only.
CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Plans are a global catalog (read active plans only).
CREATE POLICY "plans_select_authenticated"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "payments_select_owner_admin"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "payments_insert_owner_admin"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "payments_update_owner_admin"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- Harden subscriptions policies to also require organization membership.
DROP POLICY IF EXISTS "subscriptions_select_owner_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_owner_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_owner_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_owner" ON public.subscriptions;

CREATE POLICY "subscriptions_select_owner_admin"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "subscriptions_insert_owner_admin"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "subscriptions_update_owner_admin"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "subscriptions_delete_owner"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (
    public.has_organization_role(
      organization_id,
      ARRAY['OWNER']::public.member_role[]
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;

-- Keep restaurant_settings bootstrap in sync with organization tenancy.
CREATE OR REPLACE FUNCTION public.handle_new_restaurant_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.restaurant_settings (restaurant_id, organization_id)
  VALUES (NEW.id, NEW.organization_id)
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$;
