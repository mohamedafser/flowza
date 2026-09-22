-- Auth OTPs and short-lived password-reset authorizations.
-- Service-role only: no authenticated client policies.

CREATE TYPE public.auth_otp_purpose AS ENUM (
  'SIGNUP',
  'PASSWORD_RESET',
  'INVITATION'
);

CREATE TABLE public.auth_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  purpose public.auth_otp_purpose NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT auth_otps_email_normalized
    CHECK (email = lower(btrim(email)) AND email <> ''),
  CONSTRAINT auth_otps_attempt_count_nonnegative
    CHECK (attempt_count >= 0)
);

CREATE INDEX auth_otps_lookup_idx
  ON public.auth_otps (email, purpose, created_at DESC);

CREATE INDEX auth_otps_user_id_idx
  ON public.auth_otps (user_id)
  WHERE user_id IS NOT NULL;

-- One active (unverified) OTP per email+purpose; new sends replace the old hash.
CREATE UNIQUE INDEX auth_otps_active_unique
  ON public.auth_otps (email, purpose)
  WHERE verified_at IS NULL;

CREATE TABLE public.password_reset_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT password_reset_authorizations_email_normalized
    CHECK (email = lower(btrim(email)) AND email <> '')
);

CREATE INDEX password_reset_authorizations_lookup_idx
  ON public.password_reset_authorizations (user_id, created_at DESC);

ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_authorizations ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies for authenticated/anon — only service_role bypasses RLS.
REVOKE ALL ON TABLE public.auth_otps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.password_reset_authorizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_otps TO service_role;
GRANT ALL ON TABLE public.password_reset_authorizations TO service_role;
