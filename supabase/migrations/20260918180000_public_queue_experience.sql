-- Phase 9: customer-facing public queue experience.
-- Anonymous access is RPC-only (SECURITY DEFINER). No open table policies.
-- Token generation continues to use the Phase 8 concurrency-safe enqueue path.

-- ---------------------------------------------------------------------------
-- Unique restaurant phone (normalized values only; prevents duplicate guests)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_phone_unique
  ON public.customers (restaurant_id, phone)
  WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Secure public access token (unguessable; never derived from UUID/phone/token)
-- ---------------------------------------------------------------------------
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS public_access_token text;

UPDATE public.queue_entries
SET public_access_token = rtrim(
  replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
  '='
)
WHERE public_access_token IS NULL;

ALTER TABLE public.queue_entries
  ALTER COLUMN public_access_token SET NOT NULL;

ALTER TABLE public.queue_entries
  DROP CONSTRAINT IF EXISTS queue_entries_public_access_token_len;

ALTER TABLE public.queue_entries
  ADD CONSTRAINT queue_entries_public_access_token_len
  CHECK (char_length(public_access_token) BETWEEN 32 AND 64);

CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_public_access_token_key
  ON public.queue_entries (public_access_token);

-- One active party per customer per queue per business date.
CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_active_customer_unique
  ON public.queue_entries (queue_id, customer_id, business_date)
  WHERE customer_id IS NOT NULL
    AND status IN ('WAITING', 'CALLED', 'SEATED');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_queue_access_token()
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
      FROM public.queue_entries
      WHERE public_access_token = v_token
    );
    v_tries := v_tries + 1;
    IF v_tries > 8 THEN
      RAISE EXCEPTION 'QUEUE_UNKNOWN: Unable to issue an access token.';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_public_phone(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_trimmed text;
  v_has_plus boolean;
  v_digits text;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  v_trimmed := btrim(p_value);
  IF v_trimmed = '' THEN
    RETURN NULL;
  END IF;

  v_has_plus := left(v_trimmed, 1) = '+';
  v_digits := regexp_replace(v_trimmed, '\D', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  IF v_has_plus THEN
    RETURN '+' || v_digits;
  END IF;

  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_public_phone(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN false
    WHEN p_value LIKE '+%' THEN p_value ~ '^\+[1-9]\d{6,14}$'
    ELSE p_value ~ '^\d{7,15}$'
  END;
$$;

CREATE OR REPLACE FUNCTION public.branch_is_open_now(p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_timezone text;
  v_local timestamp;
  v_date date;
  v_time time;
  v_dow integer;
  v_special public.special_hours;
  v_hours public.operating_hours;
  v_has_branch_hours boolean;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id
  FROM public.branches
  WHERE id = p_branch_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_timezone := public.branch_resolved_timezone(p_branch_id);
  v_local := timezone(v_timezone, now());
  v_date := v_local::date;
  v_time := v_local::time;
  v_dow := EXTRACT(ISODOW FROM v_local)::integer;

  SELECT * INTO v_special
  FROM public.special_hours
  WHERE restaurant_id = v_restaurant_id
    AND branch_id = p_branch_id
    AND date = v_date;

  IF FOUND THEN
    IF v_special.is_closed THEN
      RETURN false;
    END IF;
    RETURN v_time >= v_special.open_time AND v_time < v_special.close_time;
  END IF;

  SELECT * INTO v_special
  FROM public.special_hours
  WHERE restaurant_id = v_restaurant_id
    AND branch_id IS NULL
    AND date = v_date;

  IF FOUND THEN
    IF v_special.is_closed THEN
      RETURN false;
    END IF;
    RETURN v_time >= v_special.open_time AND v_time < v_special.close_time;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.operating_hours
    WHERE restaurant_id = v_restaurant_id
      AND branch_id = p_branch_id
  ) INTO v_has_branch_hours;

  IF v_has_branch_hours THEN
    SELECT * INTO v_hours
    FROM public.operating_hours
    WHERE restaurant_id = v_restaurant_id
      AND branch_id = p_branch_id
      AND day_of_week = v_dow;

    IF NOT FOUND OR v_hours.is_closed THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.operating_periods p
      WHERE p.operating_hours_id = v_hours.id
        AND v_time >= p.open_time
        AND v_time < p.close_time
    );
  END IF;

  SELECT * INTO v_hours
  FROM public.operating_hours
  WHERE restaurant_id = v_restaurant_id
    AND branch_id IS NULL
    AND day_of_week = v_dow;

  IF NOT FOUND OR v_hours.is_closed THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.operating_periods p
    WHERE p.operating_hours_id = v_hours.id
      AND v_time >= p.open_time
      AND v_time < p.close_time
  );
END;
$$;

-- Caller must already hold FOR UPDATE on the queue row.
CREATE OR REPLACE FUNCTION public.queue_insert_waiting_entry(
  p_queue_id uuid,
  p_customer_id uuid,
  p_party_size integer,
  p_business_date date,
  p_max_capacity integer,
  p_created_by uuid
)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue public.queues;
  v_existing public.queue_entries;
  v_waiting_count integer;
  v_last_number integer;
  v_next_number integer;
  v_pad integer;
  v_token text;
  v_entry public.queue_entries;
BEGIN
  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = p_queue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_existing
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND customer_id = p_customer_id
    AND business_date = p_business_date
    AND status IN ('WAITING', 'CALLED', 'SEATED')
  ORDER BY joined_at ASC, id ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT count(*)::integer INTO v_waiting_count
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND business_date = p_business_date
    AND status IN ('WAITING', 'CALLED', 'SEATED');

  IF p_max_capacity IS NOT NULL AND v_waiting_count >= p_max_capacity THEN
    RAISE EXCEPTION 'QUEUE_AT_CAPACITY: Queue is currently full. Please try again later.';
  END IF;

  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(
          substr(token, char_length(v_queue.prefix) + 1),
          '[^0-9]',
          '',
          'g'
        ),
        ''
      )::integer
    ),
    v_queue.starting_number - 1
  )
  INTO v_last_number
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND business_date = p_business_date
    AND token LIKE v_queue.prefix || '%';

  v_next_number := COALESCE(v_last_number, v_queue.starting_number - 1) + 1;
  IF v_next_number < v_queue.starting_number THEN
    v_next_number := v_queue.starting_number;
  END IF;

  v_pad := GREATEST(3, char_length(v_queue.starting_number::text));
  v_token := public.format_queue_token(v_queue.prefix, v_next_number, v_pad);

  INSERT INTO public.queue_entries (
    queue_id,
    customer_id,
    token,
    business_date,
    party_size,
    status,
    joined_at,
    public_access_token
  )
  VALUES (
    v_queue.id,
    p_customer_id,
    v_token,
    p_business_date,
    p_party_size,
    'WAITING',
    timezone('utc', now()),
    public.generate_queue_access_token()
  )
  RETURNING * INTO v_entry;

  INSERT INTO public.queue_events (
    queue_entry_id,
    event_type,
    metadata,
    created_by
  )
  VALUES (
    v_entry.id,
    'JOINED',
    jsonb_build_object(
      'partySize', p_party_size,
      'businessDate', p_business_date
    ),
    p_created_by
  );

  UPDATE public.queues
  SET current_number = v_next_number
  WHERE id = v_queue.id;

  RETURN v_entry;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.queue_entries
    WHERE queue_id = v_queue.id
      AND customer_id = p_customer_id
      AND business_date = p_business_date
      AND status IN ('WAITING', 'CALLED', 'SEATED')
    ORDER BY joined_at ASC, id ASC
    LIMIT 1;

    IF FOUND THEN
      RETURN v_existing;
    END IF;

    RAISE;
END;
$$;

-- Staff enqueue: same token engine, now also issues a public access token.
CREATE OR REPLACE FUNCTION public.queue_enqueue_customer(
  p_queue_id uuid,
  p_party_size integer,
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_email text DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue public.queues;
  v_branch public.branches;
  v_restaurant_id uuid;
  v_user_id uuid;
  v_settings public.restaurant_settings;
  v_max_capacity integer;
  v_customer public.customers;
  v_timezone text;
  v_business_date date;
BEGIN
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Party size must be between 1 and 50.';
  END IF;

  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_branch
  FROM public.branches
  WHERE id = v_queue.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Branch not found.';
  END IF;

  v_restaurant_id := v_branch.restaurant_id;
  v_user_id := public.assert_queue_operator(v_restaurant_id);
  v_timezone := public.branch_resolved_timezone(v_branch.id);
  v_business_date := public.queue_business_date(v_timezone);

  SELECT * INTO v_settings
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant_id;

  IF FOUND THEN
    IF v_settings.queue_enabled IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'QUEUE_DISABLED: Queue is disabled for this restaurant.';
    END IF;

    IF v_settings.allow_manual_entry IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'QUEUE_MANUAL_ENTRY_DISABLED: Manual queue entry is turned off.';
    END IF;

    v_max_capacity := v_settings.max_queue_capacity;
  END IF;

  IF v_queue.status = 'PAUSED' THEN
    RAISE EXCEPTION 'QUEUE_PAUSED: Queue is paused.';
  END IF;

  IF v_queue.status = 'CLOSED' THEN
    RAISE EXCEPTION 'QUEUE_CLOSED: Queue is closed.';
  END IF;

  IF v_queue.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'QUEUE_CLOSED: Queue is not accepting new entries.';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_customer
    FROM public.customers
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUEUE_CUSTOMER_NOT_FOUND: Customer not found.';
    END IF;

    IF v_customer.restaurant_id <> v_restaurant_id THEN
      RAISE EXCEPTION 'QUEUE_FORBIDDEN: Customer does not belong to this restaurant.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF p_customer_name IS NULL OR char_length(btrim(p_customer_name)) < 1 THEN
      RAISE EXCEPTION 'QUEUE_CUSTOMER_REQUIRED: Customer name is required.';
    END IF;

    INSERT INTO public.customers (restaurant_id, name, phone, email)
    VALUES (
      v_restaurant_id,
      btrim(p_customer_name),
      NULLIF(btrim(p_customer_phone), ''),
      NULLIF(btrim(p_customer_email), '')
    )
    RETURNING * INTO v_customer;
  END IF;

  RETURN public.queue_insert_waiting_entry(
    v_queue.id,
    v_customer.id,
    p_party_size,
    v_business_date,
    v_max_capacity,
    v_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_queue_peer_payload(
  p_queue_id uuid,
  p_business_date date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'status', e.status,
        'joined_at', e.joined_at,
        'party_size', e.party_size,
        'token', e.token
      )
      ORDER BY e.joined_at ASC, e.id ASC
    ),
    '[]'::jsonb
  )
  FROM public.queue_entries e
  WHERE e.queue_id = p_queue_id
    AND e.business_date = p_business_date;
$$;

CREATE OR REPLACE FUNCTION public.pick_public_branch_queue(p_branch_id uuid)
RETURNS public.queues
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.queues
  WHERE branch_id = p_branch_id
  ORDER BY
    CASE status
      WHEN 'ACTIVE' THEN 0
      WHEN 'PAUSED' THEN 1
      ELSE 2
    END,
    name ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.public_queue_settings_payload(
  p_settings public.restaurant_settings
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'queue_enabled', COALESCE(p_settings.queue_enabled, true),
    'allow_self_check_in', COALESCE(p_settings.allow_self_check_in, true),
    'allow_walk_ins', COALESCE(p_settings.allow_walk_ins, true),
    'require_customer_name', COALESCE(p_settings.require_customer_name, true),
    'require_customer_phone', COALESCE(p_settings.require_customer_phone, true),
    'show_estimated_wait', COALESCE(p_settings.show_estimated_wait, true),
    'show_queue_position', COALESCE(p_settings.show_queue_position, true),
    'show_party_size', COALESCE(p_settings.show_party_size, true),
    'allow_customer_cancel', COALESCE(p_settings.allow_customer_cancel, true),
    'max_queue_capacity', p_settings.max_queue_capacity,
    'default_service_minutes', COALESCE(p_settings.default_service_minutes, 15)
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_public_branch(
  p_restaurant_slug text,
  p_branch_slug text
)
RETURNS TABLE (
  restaurant_id uuid,
  branch_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, b.id
  FROM public.restaurants r
  JOIN public.branches b
    ON b.restaurant_id = r.id
  WHERE r.slug = lower(btrim(p_restaurant_slug))
    AND r.status = 'ACTIVE'
    AND b.slug = lower(btrim(p_branch_slug))
    AND b.is_active = true
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs (granted to anon + authenticated; return only safe fields)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_queue_info(
  p_restaurant_slug text,
  p_branch_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant public.restaurants;
  v_branch public.branches;
  v_queue public.queues;
  v_settings public.restaurant_settings;
  v_timezone text;
  v_business_date date;
  v_waiting integer := 0;
  v_serving integer := 0;
  v_now_serving text;
  v_is_open boolean;
  v_reason text := 'unavailable';
  v_service_minutes integer;
  v_restaurant_id uuid;
  v_branch_id uuid;
BEGIN
  SELECT restaurant_id, branch_id
  INTO v_restaurant_id, v_branch_id
  FROM public.resolve_public_branch(p_restaurant_slug, p_branch_slug);

  IF v_restaurant_id IS NULL OR v_branch_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_restaurant_id;
  SELECT * INTO v_branch FROM public.branches WHERE id = v_branch_id;

  SELECT * INTO v_queue
  FROM public.pick_public_branch_queue(v_branch.id);

  SELECT * INTO v_settings
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant.id;

  v_timezone := public.branch_resolved_timezone(v_branch.id);
  v_business_date := public.queue_business_date(v_timezone);
  v_is_open := public.branch_is_open_now(v_branch.id);
  v_service_minutes := COALESCE(v_settings.default_service_minutes, 15);

  IF v_queue.id IS NOT NULL THEN
    v_service_minutes := COALESCE(
      v_queue.estimated_service_minutes,
      v_service_minutes
    );
    SELECT
      count(*) FILTER (WHERE status = 'WAITING')::integer,
      count(*) FILTER (WHERE status IN ('CALLED', 'SEATED'))::integer
    INTO v_waiting, v_serving
    FROM public.queue_entries
    WHERE queue_id = v_queue.id
      AND business_date = v_business_date;

    SELECT token INTO v_now_serving
    FROM public.queue_entries
    WHERE queue_id = v_queue.id
      AND business_date = v_business_date
      AND status IN ('CALLED', 'SEATED')
    ORDER BY called_at DESC NULLS LAST, joined_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF v_queue.id IS NULL THEN
    v_reason := 'unavailable';
  ELSIF COALESCE(v_settings.queue_enabled, true) IS DISTINCT FROM TRUE THEN
    v_reason := 'disabled';
  ELSIF COALESCE(v_settings.allow_self_check_in, true) IS DISTINCT FROM TRUE THEN
    v_reason := 'disabled';
  ELSIF v_queue.status = 'PAUSED' THEN
    v_reason := 'paused';
  ELSIF v_queue.status = 'CLOSED' THEN
    v_reason := 'closed';
  ELSIF NOT v_is_open THEN
    v_reason := 'outside_hours';
  ELSIF v_settings.max_queue_capacity IS NOT NULL
    AND (v_waiting + v_serving) >= v_settings.max_queue_capacity THEN
    v_reason := 'full';
  ELSIF v_queue.status = 'ACTIVE' THEN
    v_reason := 'ok';
  ELSE
    v_reason := 'closed';
  END IF;

  RETURN jsonb_build_object(
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'slug', v_restaurant.slug,
      'logo_url', v_restaurant.logo_url
    ),
    'branch', jsonb_build_object(
      'name', v_branch.name,
      'slug', v_branch.slug,
      'address_line_1', v_branch.address_line_1,
      'address_line_2', v_branch.address_line_2,
      'city', v_branch.city,
      'state', v_branch.state,
      'postal_code', v_branch.postal_code,
      'country', v_branch.country
    ),
    'queue', CASE
      WHEN v_queue.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'name', v_queue.name,
        'status', v_queue.status
      )
    END,
    'settings', public.public_queue_settings_payload(v_settings),
    'timezone', v_timezone,
    'is_open', v_is_open,
    'waiting_count', v_waiting,
    'serving_count', v_serving,
    'now_serving_token', v_now_serving,
    'estimated_service_minutes', v_service_minutes,
    'availability_reason', v_reason,
    'peers', CASE
      WHEN v_queue.id IS NULL THEN '[]'::jsonb
      ELSE public.public_queue_peer_payload(v_queue.id, v_business_date)
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_join_public(
  p_restaurant_slug text,
  p_branch_slug text,
  p_name text,
  p_phone text,
  p_party_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant public.restaurants;
  v_branch public.branches;
  v_queue public.queues;
  v_settings public.restaurant_settings;
  v_timezone text;
  v_business_date date;
  v_name text;
  v_phone text;
  v_customer_id uuid;
  v_entry public.queue_entries;
  v_reused boolean := false;
  v_existing_id uuid;
  v_restaurant_id uuid;
  v_branch_id uuid;
BEGIN
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Party size must be between 1 and 50.';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Enter a valid name.';
  END IF;

  SELECT restaurant_id, branch_id
  INTO v_restaurant_id, v_branch_id
  FROM public.resolve_public_branch(p_restaurant_slug, p_branch_slug);

  IF v_restaurant_id IS NULL OR v_branch_id IS NULL THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_restaurant_id;
  SELECT * INTO v_branch FROM public.branches WHERE id = v_branch_id;

  SELECT * INTO v_queue
  FROM public.pick_public_branch_queue(v_branch.id);

  IF NOT FOUND OR v_queue.id IS NULL THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = v_queue.id
  FOR UPDATE;

  SELECT * INTO v_settings
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant.id;

  IF COALESCE(v_settings.queue_enabled, true) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'QUEUE_DISABLED: Unable to join the queue right now.';
  END IF;

  IF COALESCE(v_settings.allow_self_check_in, true) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'QUEUE_SELF_CHECK_IN_DISABLED: Unable to join the queue right now.';
  END IF;

  IF v_queue.status = 'PAUSED' THEN
    RAISE EXCEPTION 'QUEUE_PAUSED: Queue is temporarily paused. Please try again shortly.';
  END IF;

  IF v_queue.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'QUEUE_CLOSED: Queue is currently closed.';
  END IF;

  IF NOT public.branch_is_open_now(v_branch.id) THEN
    RAISE EXCEPTION 'QUEUE_OUTSIDE_HOURS: This location is currently closed.';
  END IF;

  IF COALESCE(v_settings.require_customer_name, true) AND char_length(v_name) < 1 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Name is required.';
  END IF;

  v_phone := public.normalize_public_phone(p_phone);
  IF COALESCE(v_settings.require_customer_phone, true) THEN
    IF v_phone IS NULL OR NOT public.is_valid_public_phone(v_phone) THEN
      RAISE EXCEPTION 'QUEUE_VALIDATION: Enter a valid phone number.';
    END IF;
  ELSIF v_phone IS NOT NULL AND NOT public.is_valid_public_phone(v_phone) THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Enter a valid phone number.';
  END IF;

  v_timezone := public.branch_resolved_timezone(v_branch.id);
  v_business_date := public.queue_business_date(v_timezone);

  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE restaurant_id = v_restaurant.id
      AND phone = v_phone
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    BEGIN
      INSERT INTO public.customers (restaurant_id, name, phone)
      VALUES (v_restaurant.id, v_name, v_phone)
      RETURNING id INTO v_customer_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE restaurant_id = v_restaurant.id
          AND phone = v_phone
        LIMIT 1;

        IF v_customer_id IS NULL THEN
          RAISE EXCEPTION 'QUEUE_UNKNOWN: Unable to join the queue. Please try again.';
        END IF;
    END;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND customer_id = v_customer_id
    AND business_date = v_business_date
    AND status IN ('WAITING', 'CALLED', 'SEATED')
  LIMIT 1;

  v_entry := public.queue_insert_waiting_entry(
    v_queue.id,
    v_customer_id,
    p_party_size,
    v_business_date,
    v_settings.max_queue_capacity,
    NULL
  );

  v_reused := v_existing_id IS NOT NULL;

  RETURN jsonb_build_object(
    'access_token', v_entry.public_access_token,
    'reused', v_reused,
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'slug', v_restaurant.slug,
      'logo_url', v_restaurant.logo_url
    ),
    'branch', jsonb_build_object(
      'name', v_branch.name,
      'slug', v_branch.slug,
      'address_line_1', v_branch.address_line_1,
      'address_line_2', v_branch.address_line_2,
      'city', v_branch.city,
      'state', v_branch.state,
      'postal_code', v_branch.postal_code,
      'country', v_branch.country
    ),
    'queue', jsonb_build_object(
      'name', v_queue.name,
      'status', v_queue.status
    ),
    'settings', public.public_queue_settings_payload(v_settings),
    'timezone', v_timezone,
    'estimated_service_minutes', COALESCE(
      v_queue.estimated_service_minutes,
      v_settings.default_service_minutes,
      15
    ),
    'entry', jsonb_build_object(
      'id', v_entry.id,
      'token', v_entry.token,
      'status', v_entry.status,
      'party_size', v_entry.party_size,
      'joined_at', v_entry.joined_at,
      'table_number', NULL,
      'table_name', NULL
    ),
    'peers', public.public_queue_peer_payload(v_queue.id, v_business_date)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_queue_status(
  p_access_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_entry public.queue_entries;
  v_queue public.queues;
  v_branch public.branches;
  v_restaurant public.restaurants;
  v_settings public.restaurant_settings;
  v_table public.restaurant_tables;
  v_timezone text;
BEGIN
  v_token := btrim(COALESCE(p_access_token, ''));
  IF char_length(v_token) < 32 OR char_length(v_token) > 64 THEN
    RETURN NULL;
  END IF;
  IF v_token !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_entry
  FROM public.queue_entries
  WHERE public_access_token = v_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_queue FROM public.queues WHERE id = v_entry.queue_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_branch FROM public.branches WHERE id = v_queue.branch_id;
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_branch.restaurant_id;

  IF v_restaurant.status <> 'ACTIVE' OR v_branch.is_active IS DISTINCT FROM TRUE THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_settings
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant.id;

  IF v_entry.table_id IS NOT NULL THEN
    SELECT * INTO v_table
    FROM public.restaurant_tables
    WHERE id = v_entry.table_id;
  END IF;

  v_timezone := public.branch_resolved_timezone(v_branch.id);

  RETURN jsonb_build_object(
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'slug', v_restaurant.slug,
      'logo_url', v_restaurant.logo_url
    ),
    'branch', jsonb_build_object(
      'name', v_branch.name,
      'slug', v_branch.slug,
      'address_line_1', v_branch.address_line_1,
      'address_line_2', v_branch.address_line_2,
      'city', v_branch.city,
      'state', v_branch.state,
      'postal_code', v_branch.postal_code,
      'country', v_branch.country
    ),
    'queue', jsonb_build_object(
      'name', v_queue.name,
      'status', v_queue.status
    ),
    'settings', public.public_queue_settings_payload(v_settings),
    'timezone', v_timezone,
    'estimated_service_minutes', COALESCE(
      v_queue.estimated_service_minutes,
      v_settings.default_service_minutes,
      15
    ),
    'allow_customer_cancel', COALESCE(v_settings.allow_customer_cancel, true),
    'entry', jsonb_build_object(
      'id', v_entry.id,
      'token', v_entry.token,
      'status', v_entry.status,
      'party_size', v_entry.party_size,
      'joined_at', v_entry.joined_at,
      'table_number', v_table.table_number,
      'table_name', v_table.name
    ),
    'peers', public.public_queue_peer_payload(v_queue.id, v_entry.business_date)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_public_queue_entry(
  p_access_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_entry public.queue_entries;
  v_queue public.queues;
  v_branch public.branches;
  v_restaurant public.restaurants;
  v_settings public.restaurant_settings;
  v_from public.queue_entry_status;
  v_now timestamptz := timezone('utc', now());
BEGIN
  v_token := btrim(COALESCE(p_access_token, ''));
  IF char_length(v_token) < 32 OR char_length(v_token) > 64
    OR v_token !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'QUEUE_INVALID_TOKEN: This queue link is invalid.';
  END IF;

  SELECT e.* INTO v_entry
  FROM public.queue_entries e
  WHERE e.public_access_token = v_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_INVALID_TOKEN: This queue link is invalid.';
  END IF;

  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = v_entry.queue_id
  FOR UPDATE;

  SELECT * INTO v_entry
  FROM public.queue_entries
  WHERE id = v_entry.id
  FOR UPDATE;

  SELECT * INTO v_branch FROM public.branches WHERE id = v_queue.branch_id;
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_branch.restaurant_id;

  IF v_restaurant.status <> 'ACTIVE' OR v_branch.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'QUEUE_INVALID_TOKEN: This queue link is invalid.';
  END IF;

  SELECT * INTO v_settings
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant.id;

  IF COALESCE(v_settings.allow_customer_cancel, true) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'QUEUE_CANCEL_DISABLED: Cancellation is not available.';
  END IF;

  v_from := v_entry.status;

  IF v_from = 'CANCELLED' THEN
    RAISE EXCEPTION 'QUEUE_ALREADY_CANCELLED: Queue entry cancelled.';
  END IF;

  IF NOT public.can_transition_queue_status(v_from, 'CANCELLED') THEN
    RAISE EXCEPTION 'QUEUE_INVALID_TRANSITION: This queue entry can no longer be cancelled.';
  END IF;

  UPDATE public.queue_entries
  SET
    status = 'CANCELLED',
    cancelled_at = v_now
  WHERE id = v_entry.id
  RETURNING * INTO v_entry;

  INSERT INTO public.queue_events (
    queue_entry_id,
    event_type,
    metadata,
    created_by
  )
  VALUES (
    v_entry.id,
    'CANCELLED',
    jsonb_build_object('from', v_from, 'to', 'CANCELLED', 'source', 'customer'),
    NULL
  );

  RETURN public.get_public_queue_status(v_token);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: helpers stay internal; public RPCs are executable by anon
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.generate_queue_access_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_public_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_public_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.branch_is_open_now(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_insert_waiting_entry(
  uuid, uuid, integer, date, integer, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_queue_peer_payload(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pick_public_branch_queue(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_queue_settings_payload(
  public.restaurant_settings
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_public_branch(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_queue_info(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_join_public(
  text, text, text, text, integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_queue_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_public_queue_entry(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_queue_info(text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_join_public(
  text, text, text, text, integer
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_queue_status(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_public_queue_entry(text)
  TO anon, authenticated;

-- No anonymous SELECT/INSERT/UPDATE policies on customers, queue_entries,
-- or queue_events. Public guests only reach those tables through the RPCs
-- above, which return mapped JSON without PII.
