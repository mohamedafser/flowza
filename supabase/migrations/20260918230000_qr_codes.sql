-- Phase 12: QR Code System
-- Staff-managed QR codes that resolve to the Phase 9 public queue join experience.
-- Public access is read-only via SECURITY DEFINER RPC (no PII, no internal IDs).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'qr_code_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.qr_code_type AS ENUM ('QUEUE_JOIN');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  queue_id uuid NOT NULL REFERENCES public.queues (id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.qr_code_type NOT NULL DEFAULT 'QUEUE_JOIN',
  public_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT qr_codes_name_len
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT qr_codes_settings_object
    CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT qr_codes_public_token_len
    CHECK (char_length(public_token) BETWEEN 32 AND 64),
  CONSTRAINT qr_codes_public_token_format
    CHECK (public_token ~ '^[A-Za-z0-9_-]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_public_token_key
  ON public.qr_codes (public_token);

CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_branch_name_unique
  ON public.qr_codes (branch_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS qr_codes_restaurant_id_idx
  ON public.qr_codes (restaurant_id);

CREATE INDEX IF NOT EXISTS qr_codes_branch_id_idx
  ON public.qr_codes (branch_id);

CREATE INDEX IF NOT EXISTS qr_codes_queue_id_idx
  ON public.qr_codes (queue_id);

CREATE INDEX IF NOT EXISTS qr_codes_restaurant_active_idx
  ON public.qr_codes (restaurant_id, is_active);

DROP TRIGGER IF EXISTS qr_codes_set_updated_at ON public.qr_codes;
CREATE TRIGGER qr_codes_set_updated_at
BEFORE UPDATE ON public.qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrity: branch belongs to restaurant; queue belongs to branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qr_codes_enforce_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_branch_restaurant uuid;
  v_queue_branch uuid;
BEGIN
  SELECT restaurant_id INTO v_branch_restaurant
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF v_branch_restaurant IS NULL THEN
    RAISE EXCEPTION 'QR_VALIDATION: Branch not found.';
  END IF;

  IF v_branch_restaurant IS DISTINCT FROM NEW.restaurant_id THEN
    RAISE EXCEPTION 'QR_VALIDATION: Branch must belong to the restaurant.';
  END IF;

  SELECT branch_id INTO v_queue_branch
  FROM public.queues
  WHERE id = NEW.queue_id;

  IF v_queue_branch IS NULL THEN
    RAISE EXCEPTION 'QR_VALIDATION: Queue not found.';
  END IF;

  IF v_queue_branch IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'QR_VALIDATION: Queue must belong to the same branch.';
  END IF;

  NEW.name := btrim(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qr_codes_enforce_relationships ON public.qr_codes;
CREATE TRIGGER qr_codes_enforce_relationships
BEFORE INSERT OR UPDATE OF restaurant_id, branch_id, queue_id, name ON public.qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.qr_codes_enforce_relationships();

-- ---------------------------------------------------------------------------
-- Token generation (32-byte URL-safe, not derived from IDs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_qr_public_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
  v_tries integer := 0;
BEGIN
  LOOP
    v_token := rtrim(
      replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
      '='
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.qr_codes
      WHERE public_token = v_token
    );
    v_tries := v_tries + 1;
    IF v_tries > 8 THEN
      RAISE EXCEPTION 'QR_UNKNOWN: Unable to issue a QR token.';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_qr_public_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_qr_public_token()
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public read-only resolution (safe fields only — never PII / internal IDs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_qr_code(
  p_public_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_qr public.qr_codes;
  v_queue public.queues;
  v_branch public.branches;
  v_restaurant public.restaurants;
BEGIN
  v_token := btrim(COALESCE(p_public_token, ''));
  IF char_length(v_token) < 32 OR char_length(v_token) > 64 THEN
    RETURN NULL;
  END IF;
  IF v_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_codes
  WHERE public_token = v_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_qr.is_active IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'inactive'
    );
  END IF;

  IF v_qr.type <> 'QUEUE_JOIN' THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'unsupported'
    );
  END IF;

  SELECT * INTO v_queue FROM public.queues WHERE id = v_qr.queue_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'inactive'
    );
  END IF;

  SELECT * INTO v_branch FROM public.branches WHERE id = v_qr.branch_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'inactive'
    );
  END IF;

  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_qr.restaurant_id;
  IF NOT FOUND
     OR v_restaurant.status <> 'ACTIVE'
     OR v_branch.is_active IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'inactive'
    );
  END IF;

  RETURN jsonb_build_object(
    'unavailable', false,
    'type', v_qr.type::text,
    'qr', jsonb_build_object(
      'name', v_qr.name
    ),
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'slug', v_restaurant.slug
    ),
    'branch', jsonb_build_object(
      'name', v_branch.name,
      'slug', v_branch.slug
    ),
    'queue', jsonb_build_object(
      'name', v_queue.name
    ),
    'join_path',
      '/queue/' || v_restaurant.slug || '/' || v_branch.slug || '/join'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_qr_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_qr_code(text)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_codes_select_member" ON public.qr_codes;
CREATE POLICY "qr_codes_select_member"
  ON public.qr_codes
  FOR SELECT
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
    )
  );

DROP POLICY IF EXISTS "qr_codes_insert_manager_up" ON public.qr_codes;
CREATE POLICY "qr_codes_insert_manager_up"
  ON public.qr_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

DROP POLICY IF EXISTS "qr_codes_update_manager_up" ON public.qr_codes;
CREATE POLICY "qr_codes_update_manager_up"
  ON public.qr_codes
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

DROP POLICY IF EXISTS "qr_codes_delete_manager_up" ON public.qr_codes;
CREATE POLICY "qr_codes_delete_manager_up"
  ON public.qr_codes
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );
