-- Phase 16: Subscription & Billing foundation
-- Extends existing plans / subscriptions / payments (no duplicate catalogs).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'PAUSED';

CREATE TYPE public.payment_status AS ENUM (
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED'
);

-- ---------------------------------------------------------------------------
-- Plans catalog: monthly + yearly pricing, limits, stable codes
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS monthly_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS yearly_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.plans
SET
  monthly_price = COALESCE(monthly_price, price),
  yearly_price = COALESCE(yearly_price, ROUND(price * 10, 2)),
  code = COALESCE(
    NULLIF(code, ''),
    upper(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '_', 'g')),
    'PLAN_' || substr(replace(id::text, '-', ''), 1, 8)
  )
WHERE monthly_price IS NULL
   OR yearly_price IS NULL
   OR code IS NULL
   OR code = '';

ALTER TABLE public.plans
  ALTER COLUMN monthly_price SET DEFAULT 0,
  ALTER COLUMN yearly_price SET DEFAULT 0,
  ALTER COLUMN monthly_price SET NOT NULL,
  ALTER COLUMN yearly_price SET NOT NULL,
  ALTER COLUMN code SET NOT NULL;

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_monthly_price_non_negative;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_monthly_price_non_negative CHECK (monthly_price >= 0);

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_yearly_price_non_negative;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_yearly_price_non_negative CHECK (yearly_price >= 0);

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_limits_object;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_limits_object CHECK (jsonb_typeof(limits) = 'object');

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_code_format;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$');

CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique
  ON public.plans (code);

CREATE INDEX IF NOT EXISTS plans_active_sort_idx
  ON public.plans (is_active, sort_order, name);

-- Seed default plans (idempotent by code).
INSERT INTO public.plans (
  code,
  name,
  description,
  price,
  monthly_price,
  yearly_price,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  sort_order
)
VALUES
  (
    'FREE',
    'Free',
    'Essential queue tools for a single location.',
    0,
    0,
    0,
    'INR',
    'MONTHLY',
    jsonb_build_object(
      'basic_queue', true,
      'basic_customers', true,
      'basic_dashboard', true,
      'reservations', false,
      'notifications', false,
      'tv_displays', false,
      'analytics', false,
      'advanced_analytics', false,
      'exports', false,
      'multiple_displays', false
    ),
    jsonb_build_object(
      'max_branches', 1,
      'max_staff', 2,
      'max_tables', 2,
      'max_queue_entries_per_month', 100,
      'max_reservations_per_month', 0,
      'max_displays', 0
    ),
    true,
    10
  ),
  (
    'STARTER',
    'Starter',
    'Reservations, displays, notifications, and analytics for growing teams.',
    1499,
    1499,
    14990,
    'INR',
    'MONTHLY',
    jsonb_build_object(
      'basic_queue', true,
      'basic_customers', true,
      'basic_dashboard', true,
      'reservations', true,
      'notifications', true,
      'tv_displays', true,
      'analytics', true,
      'advanced_analytics', false,
      'exports', true,
      'multiple_displays', false
    ),
    jsonb_build_object(
      'max_branches', 2,
      'max_staff', 10,
      'max_tables', 25,
      'max_queue_entries_per_month', 1000,
      'max_reservations_per_month', 500,
      'max_displays', 2
    ),
    true,
    20
  ),
  (
    'BUSINESS',
    'Business',
    'Higher limits, advanced analytics, and multiple TV displays.',
    3999,
    3999,
    39990,
    'INR',
    'MONTHLY',
    jsonb_build_object(
      'basic_queue', true,
      'basic_customers', true,
      'basic_dashboard', true,
      'reservations', true,
      'notifications', true,
      'tv_displays', true,
      'analytics', true,
      'advanced_analytics', true,
      'exports', true,
      'multiple_displays', true
    ),
    jsonb_build_object(
      'max_branches', 5,
      'max_staff', 30,
      'max_tables', 100,
      'max_queue_entries_per_month', 5000,
      'max_reservations_per_month', 2500,
      'max_displays', 10
    ),
    true,
    30
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.monthly_price,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

-- ---------------------------------------------------------------------------
-- Subscriptions: restaurant-scoped billing state
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle public.billing_cycle
    NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS trial_start timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_trial_order;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_trial_order CHECK (
    trial_start IS NULL
    OR trial_end IS NULL
    OR trial_end >= trial_start
  );

-- One subscription row per restaurant (update in place).
-- Do not reference newly added enum labels (e.g. PAUSED) in this same
-- transaction — Postgres requires them to be committed first (55P04).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY restaurant_id
      ORDER BY
        CASE status
          WHEN 'ACTIVE' THEN 1
          WHEN 'TRIALING' THEN 2
          WHEN 'PAST_DUE' THEN 3
          ELSE 4
        END,
        updated_at DESC,
        created_at DESC
    ) AS rn
  FROM public.subscriptions
)
DELETE FROM public.subscriptions s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_restaurant_id_unique
  ON public.subscriptions (restaurant_id);

CREATE INDEX IF NOT EXISTS subscriptions_provider_customer_idx
  ON public.subscriptions (provider, provider_customer_id)
  WHERE provider IS NOT NULL AND provider_customer_id IS NOT NULL;

-- Backfill FREE subscriptions for restaurants that do not have one yet.
INSERT INTO public.subscriptions (
  restaurant_id,
  organization_id,
  plan_id,
  plan,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  trial_start,
  trial_end
)
SELECT
  r.id,
  r.organization_id,
  p.id,
  p.code,
  'TRIALING'::public.subscription_status,
  'MONTHLY'::public.billing_cycle,
  timezone('utc', now()),
  timezone('utc', now()) + interval '14 days',
  timezone('utc', now()),
  timezone('utc', now()) + interval '14 days'
FROM public.restaurants r
CROSS JOIN public.plans p
WHERE p.code = 'FREE'
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.restaurant_id = r.id
  );

UPDATE public.subscriptions s
SET
  plan_id = p.id,
  plan = p.code
FROM public.plans p
WHERE p.code = 'FREE'
  AND s.plan_id IS NULL;

UPDATE public.organizations o
SET plan_id = s.plan_id
FROM public.subscriptions s
WHERE s.organization_id = o.id
  AND o.plan_id IS NULL
  AND s.plan_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Payments / invoices
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS restaurant_id uuid
    REFERENCES public.restaurants (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_invoice_id text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS billing_cycle public.billing_cycle,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.payments p
SET restaurant_id = s.restaurant_id
FROM public.subscriptions s
WHERE p.subscription_id = s.id
  AND p.restaurant_id IS NULL;

UPDATE public.payments p
SET restaurant_id = o.id
FROM public.organizations o
WHERE p.organization_id = o.id
  AND p.restaurant_id IS NULL;

-- Prefer restaurant_id going forward; keep organization_id for tenancy.
ALTER TABLE public.payments
  ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_metadata_object;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_metadata_object CHECK (jsonb_typeof(metadata) = 'object');

-- Normalize legacy free-text statuses into payment_status enum values,
-- then convert the column type safely.
UPDATE public.payments
SET status = upper(status);

UPDATE public.payments
SET status = CASE
  WHEN status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') THEN status
  WHEN status IN ('PAID', 'CAPTURED', 'COMPLETED') THEN 'SUCCESS'
  WHEN status IN ('CANCELLED', 'CANCELED', 'ERROR') THEN 'FAILED'
  ELSE 'PENDING'
END;

ALTER TABLE public.payments
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.payments
  ALTER COLUMN status TYPE public.payment_status
  USING status::public.payment_status;

ALTER TABLE public.payments
  ALTER COLUMN status SET DEFAULT 'PENDING'::public.payment_status;

CREATE INDEX IF NOT EXISTS payments_restaurant_id_idx
  ON public.payments (restaurant_id);

CREATE INDEX IF NOT EXISTS payments_restaurant_created_idx
  ON public.payments (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_unique
  ON public.payments (provider, provider_payment_id)
  WHERE provider IS NOT NULL AND provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_invoice_unique
  ON public.payments (provider, provider_invoice_id)
  WHERE provider IS NOT NULL AND provider_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Webhook idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT webhook_events_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, event_id)
);

CREATE INDEX webhook_events_created_idx
  ON public.webhook_events (created_at DESC);

CREATE INDEX webhook_events_unprocessed_idx
  ON public.webhook_events (provider, created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — webhooks are service-role only.
GRANT ALL ON public.webhook_events TO service_role;

-- ---------------------------------------------------------------------------
-- Payments RLS: restaurant-scoped owner/admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "payments_select_owner_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_owner_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_owner_admin" ON public.payments;

CREATE POLICY "payments_select_owner_admin"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- Client inserts/updates are not used for provider-backed payments.
-- Service role writes payment rows from checkout / webhook handlers.

-- ---------------------------------------------------------------------------
-- Usage aggregation helpers (server-side counts; no full table scans in browser)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.billing_usage_summary(
  p_restaurant_id uuid,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_result jsonb;
BEGIN
  -- Service-role system jobs (public queue enforcement) have no auth.uid().
  IF auth.uid() IS NULL AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_restaurant_member(p_restaurant_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found' USING ERRCODE = 'P0002';
  END IF;

  v_period_start := COALESCE(
    p_period_start,
    date_trunc('month', timezone('utc', now()))
  );
  v_period_end := COALESCE(p_period_end, timezone('utc', now()));

  SELECT jsonb_build_object(
    'branches', (
      SELECT count(*)::int
      FROM public.branches b
      WHERE b.restaurant_id = p_restaurant_id
        AND b.is_active = true
    ),
    'staff', (
      SELECT count(*)::int
      FROM public.restaurant_members rm
      WHERE rm.restaurant_id = p_restaurant_id
        AND rm.status = 'ACTIVE'
    ),
    'tables', (
      SELECT count(*)::int
      FROM public.restaurant_tables rt
      INNER JOIN public.branches b ON b.id = rt.branch_id
      WHERE b.restaurant_id = p_restaurant_id
    ),
    'queue_entries', (
      SELECT count(*)::int
      FROM public.queue_entries qe
      INNER JOIN public.queues q ON q.id = qe.queue_id
      INNER JOIN public.branches b ON b.id = q.branch_id
      WHERE b.restaurant_id = p_restaurant_id
        AND qe.created_at >= v_period_start
        AND qe.created_at < v_period_end
    ),
    'reservations', (
      SELECT count(*)::int
      FROM public.reservations r
      INNER JOIN public.branches b ON b.id = r.branch_id
      WHERE b.restaurant_id = p_restaurant_id
        AND r.created_at >= v_period_start
        AND r.created_at < v_period_end
    ),
    'displays', (
      SELECT count(*)::int
      FROM public.displays d
      INNER JOIN public.branches b ON b.id = d.branch_id
      WHERE b.restaurant_id = p_restaurant_id
        AND d.is_active = true
    ),
    'period_start', v_period_start,
    'period_end', v_period_end
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_usage_summary(uuid, timestamptz, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_usage_summary(uuid, timestamptz, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_usage_summary(uuid, timestamptz, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Auto-provision FREE trial subscription on restaurant create
-- ---------------------------------------------------------------------------
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
  v_plan public.plans;
  v_trial_end timestamptz := timezone('utc', now()) + interval '14 days';
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

  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = 'FREE' AND is_active = true
  ORDER BY sort_order ASC
  LIMIT 1;

  INSERT INTO public.organizations (name, business_type, status, plan_id)
  VALUES (
    p_name,
    COALESCE(p_business_type, 'RESTAURANT'::public.organization_business_type),
    'ACTIVE'::public.organization_status,
    v_plan.id
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

  IF v_plan.id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      restaurant_id,
      organization_id,
      plan_id,
      plan,
      status,
      billing_cycle,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end
    )
    VALUES (
      v_restaurant.id,
      v_organization_id,
      v_plan.id,
      v_plan.code,
      'TRIALING'::public.subscription_status,
      'MONTHLY'::public.billing_cycle,
      timezone('utc', now()),
      v_trial_end,
      timezone('utc', now()),
      v_trial_end
    )
    ON CONFLICT (restaurant_id) DO NOTHING;
  END IF;

  RETURN v_restaurant;
END;
$$;

REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, public.organization_business_type
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, public.organization_business_type
) TO authenticated;
