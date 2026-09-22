-- Phase 18: Security hardening
-- Prevent privilege escalation via profiles.platform_role / account_status.
-- Authenticated users may update their own profile identity fields only.
-- Service role (and SECURITY DEFINER ops using it) may change privileged columns.

CREATE OR REPLACE FUNCTION public.protect_profile_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    auth.role(),
    current_setting('request.jwt.claim.role', true),
    ''
  );

  -- Service role / postgres bypass (platform ops, admin services).
  IF jwt_role IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.platform_role IS NOT NULL THEN
      RAISE EXCEPTION 'PROFILE_PRIVILEGE: platform_role cannot be set by clients'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.account_status IS DISTINCT FROM 'ACTIVE'::public.account_status THEN
      RAISE EXCEPTION 'PROFILE_PRIVILEGE: account_status cannot be set by clients'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.platform_role IS DISTINCT FROM OLD.platform_role THEN
      RAISE EXCEPTION 'PROFILE_PRIVILEGE: platform_role cannot be changed by clients'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'PROFILE_PRIVILEGE: account_status cannot be changed by clients'
        USING ERRCODE = '42501';
    END IF;
    -- Identity must remain self.
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'PROFILE_PRIVILEGE: profile id cannot be changed'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privilege_columns ON public.profiles;

CREATE TRIGGER profiles_protect_privilege_columns
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privilege_columns();

REVOKE ALL ON FUNCTION public.protect_profile_privilege_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_profile_privilege_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_privilege_columns() TO service_role;

COMMENT ON FUNCTION public.protect_profile_privilege_columns() IS
  'Phase 18: block client self-assignment of SUPER_ADMIN / account_status.';
