-- Phase 11: TV / public queue display
-- Extends existing displays table with queue binding, secure public token, and settings.
-- Public access is read-only via SECURITY DEFINER RPC (no PII).

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.displays
  ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES public.queues (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.displays
  DROP CONSTRAINT IF EXISTS displays_settings_object;

ALTER TABLE public.displays
  ADD CONSTRAINT displays_settings_object
  CHECK (jsonb_typeof(settings) = 'object');

-- Backfill queue_id from the branch's first queue (by created_at).
UPDATE public.displays d
SET queue_id = q.id
FROM (
  SELECT DISTINCT ON (branch_id) id, branch_id
  FROM public.queues
  ORDER BY branch_id, created_at ASC, id ASC
) q
WHERE d.queue_id IS NULL
  AND d.branch_id = q.branch_id;

-- Displays without a queue cannot be public; remove orphans that cannot bind.
DELETE FROM public.displays
WHERE queue_id IS NULL;

ALTER TABLE public.displays
  ALTER COLUMN queue_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS displays_queue_id_idx ON public.displays (queue_id);

CREATE OR REPLACE FUNCTION public.generate_display_public_token()
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
      FROM public.displays
      WHERE public_token = v_token
    );
    v_tries := v_tries + 1;
    IF v_tries > 8 THEN
      RAISE EXCEPTION 'DISPLAY_UNKNOWN: Unable to issue a display token.';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_display_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_code text;
  v_tries integer := 0;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_i integer;
BEGIN
  LOOP
    v_bytes := gen_random_bytes(6);
    v_code := '';
    FOR v_i IN 0..5 LOOP
      v_code := v_code || substr(
        v_alphabet,
        (get_byte(v_bytes, v_i) % length(v_alphabet)) + 1,
        1
      );
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.displays
      WHERE display_code = v_code
    );
    v_tries := v_tries + 1;
    IF v_tries > 16 THEN
      RAISE EXCEPTION 'DISPLAY_UNKNOWN: Unable to issue a display code.';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Backfill secure public tokens for existing rows.
UPDATE public.displays
SET public_token = public.generate_display_public_token()
WHERE public_token IS NULL;

ALTER TABLE public.displays
  ALTER COLUMN public_token SET NOT NULL;

ALTER TABLE public.displays
  DROP CONSTRAINT IF EXISTS displays_public_token_len;

ALTER TABLE public.displays
  ADD CONSTRAINT displays_public_token_len
  CHECK (char_length(public_token) BETWEEN 32 AND 64);

ALTER TABLE public.displays
  DROP CONSTRAINT IF EXISTS displays_public_token_format;

ALTER TABLE public.displays
  ADD CONSTRAINT displays_public_token_format
  CHECK (public_token ~ '^[A-Za-z0-9_-]+$');

CREATE UNIQUE INDEX IF NOT EXISTS displays_public_token_key
  ON public.displays (public_token);

-- One active display name per branch (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS displays_branch_name_unique
  ON public.displays (branch_id, lower(btrim(name)));

-- Ensure queue belongs to the same branch as the display.
CREATE OR REPLACE FUNCTION public.displays_enforce_queue_branch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_queue_branch uuid;
BEGIN
  SELECT branch_id INTO v_queue_branch
  FROM public.queues
  WHERE id = NEW.queue_id;

  IF v_queue_branch IS NULL THEN
    RAISE EXCEPTION 'DISPLAY_VALIDATION: Queue not found.';
  END IF;

  IF v_queue_branch IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'DISPLAY_VALIDATION: Queue must belong to the same branch.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS displays_enforce_queue_branch ON public.displays;
CREATE TRIGGER displays_enforce_queue_branch
BEFORE INSERT OR UPDATE OF branch_id, queue_id ON public.displays
FOR EACH ROW
EXECUTE FUNCTION public.displays_enforce_queue_branch();

REVOKE ALL ON FUNCTION public.generate_display_public_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_display_public_token()
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.generate_display_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_display_code()
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Default settings helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_display_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_input jsonb := COALESCE(p_settings, '{}'::jsonb);
  v_next integer;
  v_theme text;
BEGIN
  IF jsonb_typeof(v_input) <> 'object' THEN
    v_input := '{}'::jsonb;
  END IF;

  BEGIN
    v_next := COALESCE((v_input ->> 'nextTokenCount')::integer, 3);
  EXCEPTION WHEN others THEN
    v_next := 3;
  END;

  IF v_next < 1 THEN
    v_next := 1;
  ELSIF v_next > 12 THEN
    v_next := 12;
  END IF;

  v_theme := lower(COALESCE(v_input ->> 'theme', 'dark'));
  IF v_theme NOT IN ('light', 'dark', 'system') THEN
    v_theme := 'dark';
  END IF;

  RETURN jsonb_build_object(
    'nextTokenCount', v_next,
    'showRestaurantLogo', COALESCE((v_input ->> 'showRestaurantLogo')::boolean, true),
    'showBranchName', COALESCE((v_input ->> 'showBranchName')::boolean, true),
    'showQueueName', COALESCE((v_input ->> 'showQueueName')::boolean, true),
    'theme', v_theme,
    'preferFullscreen', COALESCE((v_input ->> 'preferFullscreen')::boolean, false)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Public read-only display payload (tokens only — never customer PII)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_display(
  p_public_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_display public.displays;
  v_queue public.queues;
  v_branch public.branches;
  v_restaurant public.restaurants;
  v_timezone text;
  v_business_date date;
  v_settings jsonb;
  v_next_count integer;
  v_now_serving text;
  v_next_tokens jsonb;
  v_status_label text;
BEGIN
  v_token := btrim(COALESCE(p_public_token, ''));
  IF char_length(v_token) < 32 OR char_length(v_token) > 64 THEN
    RETURN NULL;
  END IF;
  IF v_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_display
  FROM public.displays
  WHERE public_token = v_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_display.is_active IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'inactive'
    );
  END IF;

  SELECT * INTO v_queue FROM public.queues WHERE id = v_display.queue_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'queue_unavailable'
    );
  END IF;

  SELECT * INTO v_branch FROM public.branches WHERE id = v_display.branch_id;
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_branch.restaurant_id;

  IF v_restaurant.status <> 'ACTIVE' OR v_branch.is_active IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object(
      'unavailable', true,
      'reason', 'inactive'
    );
  END IF;

  v_settings := public.normalize_display_settings(v_display.settings);
  v_next_count := COALESCE((v_settings ->> 'nextTokenCount')::integer, 3);
  v_timezone := public.branch_resolved_timezone(v_branch.id);
  v_business_date := public.queue_business_date(v_timezone);

  -- Touch last_seen_at for staff monitoring (best-effort, no client visibility of timing details).
  UPDATE public.displays
  SET last_seen_at = timezone('utc', now())
  WHERE id = v_display.id
    AND (
      last_seen_at IS NULL
      OR last_seen_at < timezone('utc', now()) - interval '30 seconds'
    );

  -- Now serving: CALLED only (never SEATED / completed / skipped / cancelled / no-show).
  SELECT token INTO v_now_serving
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND business_date = v_business_date
    AND status = 'CALLED'
  ORDER BY called_at DESC NULLS LAST, joined_at DESC, id DESC
  LIMIT 1;

  -- Next: WAITING only, authoritative Phase 8 order.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('token', e.token)
      ORDER BY e.joined_at ASC, e.token ASC, e.id ASC
    ),
    '[]'::jsonb
  )
  INTO v_next_tokens
  FROM (
    SELECT token, joined_at, id
    FROM public.queue_entries
    WHERE queue_id = v_queue.id
      AND business_date = v_business_date
      AND status = 'WAITING'
    ORDER BY joined_at ASC, token ASC, id ASC
    LIMIT v_next_count
  ) e;

  v_status_label := CASE v_queue.status
    WHEN 'ACTIVE' THEN 'Queue Open'
    WHEN 'PAUSED' THEN 'Queue Temporarily Paused'
    ELSE 'Queue Closed'
  END;

  -- When closed with nobody called, clear now-serving to avoid misleading state.
  IF v_queue.status = 'CLOSED' AND v_now_serving IS NULL THEN
    v_now_serving := NULL;
  END IF;

  RETURN jsonb_build_object(
    'unavailable', false,
    'display', jsonb_build_object(
      'name', v_display.name,
      'mode', v_display.mode
    ),
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'logo_url', v_restaurant.logo_url
    ),
    'branch', jsonb_build_object(
      'name', v_branch.name
    ),
    'queue', jsonb_build_object(
      'name', v_queue.name,
      'status', v_queue.status,
      'status_label', v_status_label
    ),
    'now_serving', CASE
      WHEN v_now_serving IS NULL THEN NULL
      ELSE jsonb_build_object('token', v_now_serving)
    END,
    'next_tokens', v_next_tokens,
    'settings', v_settings,
    'realtime_channel', public.queue_realtime_topic(
      v_restaurant.id,
      v_queue.id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_display(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_display(text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.normalize_display_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_display_settings(jsonb)
  TO authenticated, service_role;
