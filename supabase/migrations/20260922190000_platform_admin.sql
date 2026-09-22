-- Phase 17: SaaS Admin & Platform Management
-- Platform SUPER_ADMIN is separate from restaurant member roles.
-- Privileged cross-tenant reads/writes use the service-role client after
-- application-layer SUPER_ADMIN checks — RLS is not disabled.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.platform_role AS ENUM ('SUPER_ADMIN');

CREATE TYPE public.account_status AS ENUM ('ACTIVE', 'DISABLED');

-- ---------------------------------------------------------------------------
-- Profiles: platform role + account status (no self-service SUPER_ADMIN)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_role public.platform_role,
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS profiles_platform_role_idx
  ON public.profiles (platform_role)
  WHERE platform_role IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_account_status_idx
  ON public.profiles (account_status);

CREATE INDEX IF NOT EXISTS profiles_full_name_lower_idx
  ON public.profiles (lower(full_name));

-- ---------------------------------------------------------------------------
-- Platform settings (singleton-style key/value)
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT platform_settings_value_object CHECK (jsonb_typeof(value) = 'object')
);

CREATE TRIGGER platform_settings_set_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value)
VALUES
  (
    'general',
    jsonb_build_object(
      'platform_name', 'Flowza',
      'support_email', 'support@flowza.app',
      'default_trial_days', 14,
      'default_currency', 'INR',
      'default_timezone', 'Asia/Kolkata',
      'maintenance_mode', false,
      'maintenance_message',
        'Flowza is undergoing scheduled maintenance. Please try again shortly.'
    )
  )
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: only service-role / SECURITY DEFINER paths write.
-- Explicit deny keeps accidental anon/authenticated policies from opening this.

-- ---------------------------------------------------------------------------
-- Audit logs: allow platform-scoped rows (nullable restaurant/org)
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs
  ALTER COLUMN restaurant_id DROP NOT NULL;

ALTER TABLE public.audit_logs
  ALTER COLUMN organization_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
  ON public.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
  ON public.audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Admin query indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS restaurants_status_created_idx
  ON public.restaurants (status, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurants_name_lower_idx
  ON public.restaurants (lower(name));

CREATE INDEX IF NOT EXISTS subscriptions_status_created_idx
  ON public.subscriptions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS subscriptions_plan_status_idx
  ON public.subscriptions (plan, status);

CREATE INDEX IF NOT EXISTS payments_status_created_idx
  ON public.payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_restaurant_created_idx
  ON public.payments (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_paid_at_idx
  ON public.payments (paid_at DESC)
  WHERE paid_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helper: is the current auth user a platform SUPER_ADMIN?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.platform_role = 'SUPER_ADMIN'::public.platform_role
      AND p.account_status = 'ACTIVE'::public.account_status
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO service_role;

-- Grant SUPER_ADMIN only via secure ops (service role / SQL), never signup:
--   UPDATE public.profiles
--   SET platform_role = 'SUPER_ADMIN'
--   WHERE id = '<auth-user-uuid>';

-- ---------------------------------------------------------------------------
-- Service-role grants for new table
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO service_role;
