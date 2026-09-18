-- Phase 8: queue management engine.
-- Token generation, Call Next, seating, and completion are concurrency-safe RPCs.
-- Tenant isolation remains RLS + in-function membership checks.

-- ---------------------------------------------------------------------------
-- Queue configuration: starting number (queue-specific override of restaurant default)
-- ---------------------------------------------------------------------------
ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS starting_number integer NOT NULL DEFAULT 1;

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_starting_number_positive;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_starting_number_positive
  CHECK (starting_number >= 1 AND starting_number <= 999999);

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_prefix_format;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_prefix_format
  CHECK (prefix ~ '^[A-Z0-9]{1,8}$');

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_name_not_blank;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_name_not_blank
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 80);

-- ---------------------------------------------------------------------------
-- Queue entries: table assignment + skip / no-show timestamps
-- ---------------------------------------------------------------------------
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS table_id uuid
    REFERENCES public.restaurant_tables (id) ON DELETE SET NULL;

ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz;

ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz;

ALTER TABLE public.queue_entries
  DROP CONSTRAINT IF EXISTS queue_entries_party_size_range;

ALTER TABLE public.queue_entries
  ADD CONSTRAINT queue_entries_party_size_range
  CHECK (party_size BETWEEN 1 AND 50);

CREATE INDEX IF NOT EXISTS queue_entries_joined_at_idx
  ON public.queue_entries (queue_id, joined_at, id);

CREATE INDEX IF NOT EXISTS queue_entries_business_date_idx
  ON public.queue_entries (queue_id, business_date, status);

CREATE INDEX IF NOT EXISTS queue_entries_table_id_idx
  ON public.queue_entries (table_id)
  WHERE table_id IS NOT NULL;

-- A table cannot be assigned to two seated parties at once.
CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_active_table_unique
  ON public.queue_entries (table_id)
  WHERE table_id IS NOT NULL AND status = 'SEATED';

-- ---------------------------------------------------------------------------
-- Table must belong to the same branch as the queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_queue_entry_table_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_queue_branch uuid;
  v_table_branch uuid;
BEGIN
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT q.branch_id INTO v_queue_branch
  FROM public.queues q
  WHERE q.id = NEW.queue_id;

  SELECT t.branch_id INTO v_table_branch
  FROM public.restaurant_tables t
  WHERE t.id = NEW.table_id;

  IF v_queue_branch IS NULL OR v_table_branch IS NULL THEN
    RAISE EXCEPTION 'queue entry or table not found for branch check';
  END IF;

  IF v_queue_branch <> v_table_branch THEN
    RAISE EXCEPTION 'table must belong to the same branch as the queue';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_entries_enforce_table_branch ON public.queue_entries;
CREATE TRIGGER queue_entries_enforce_table_branch
BEFORE INSERT OR UPDATE OF queue_id, table_id ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_queue_entry_table_branch();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_transition_queue_status(
  p_from public.queue_entry_status,
  p_to public.queue_entry_status
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_from
    WHEN 'WAITING' THEN p_to IN ('CALLED', 'SKIPPED', 'CANCELLED', 'NO_SHOW')
    WHEN 'CALLED' THEN p_to IN ('SEATED', 'SKIPPED', 'CANCELLED', 'NO_SHOW')
    WHEN 'SEATED' THEN p_to = 'COMPLETED'
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.format_queue_token(
  p_prefix text,
  p_number integer,
  p_pad integer DEFAULT 3
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_prefix || lpad(
    p_number::text,
    GREATEST(COALESCE(p_pad, 3), char_length(p_number::text)),
    '0'
  );
$$;

CREATE OR REPLACE FUNCTION public.queue_business_date(p_timezone text)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone(
    COALESCE(NULLIF(btrim(p_timezone), ''), 'UTC'),
    now()
  ))::date;
$$;

CREATE OR REPLACE FUNCTION public.branch_resolved_timezone(p_branch_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN b.use_restaurant_timezone THEN COALESCE(NULLIF(btrim(r.timezone), ''), 'UTC')
    ELSE COALESCE(
      NULLIF(btrim(b.timezone), ''),
      NULLIF(btrim(r.timezone), ''),
      'UTC'
    )
  END
  FROM public.branches b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_branch_id;
$$;

CREATE OR REPLACE FUNCTION public.assert_queue_operator(p_restaurant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'QUEUE_UNAUTHENTICATED: Sign in to continue.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_restaurant_role(
    p_restaurant_id,
    ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
  ) THEN
    RAISE EXCEPTION 'QUEUE_FORBIDDEN: You do not have permission to manage this queue.'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Atomic enqueue + token generation
-- ---------------------------------------------------------------------------
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
  v_waiting_count integer;
  v_last_number integer;
  v_next_number integer;
  v_pad integer;
  v_token text;
  v_entry public.queue_entries;
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

  SELECT count(*)::integer INTO v_waiting_count
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND business_date = v_business_date
    AND status IN ('WAITING', 'CALLED', 'SEATED');

  IF v_max_capacity IS NOT NULL AND v_waiting_count >= v_max_capacity THEN
    RAISE EXCEPTION 'QUEUE_AT_CAPACITY: The queue is at capacity.';
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
    AND business_date = v_business_date
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
    joined_at
  )
  VALUES (
    v_queue.id,
    v_customer.id,
    v_token,
    v_business_date,
    p_party_size,
    'WAITING',
    timezone('utc', now())
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
      'businessDate', v_business_date
    ),
    v_user_id
  );

  UPDATE public.queues
  SET current_number = v_next_number
  WHERE id = v_queue.id;

  RETURN v_entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- Call next waiting entry (serialized per queue)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_call_next(p_queue_id uuid)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue public.queues;
  v_restaurant_id uuid;
  v_user_id uuid;
  v_entry public.queue_entries;
BEGIN
  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT b.restaurant_id INTO v_restaurant_id
  FROM public.branches b
  WHERE b.id = v_queue.branch_id;

  v_user_id := public.assert_queue_operator(v_restaurant_id);

  SELECT * INTO v_entry
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND status = 'WAITING'
  ORDER BY joined_at ASC, id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_EMPTY: No customers are currently waiting.';
  END IF;

  UPDATE public.queue_entries
  SET
    status = 'CALLED',
    called_at = timezone('utc', now())
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
    'CALLED',
    jsonb_build_object('from', 'WAITING', 'to', 'CALLED'),
    v_user_id
  );

  RETURN v_entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- Status transition (call / skip / cancel / no-show / seat / complete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_transition_entry(
  p_entry_id uuid,
  p_to_status public.queue_entry_status,
  p_table_id uuid DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.queue_entries;
  v_queue public.queues;
  v_queue_id uuid;
  v_restaurant_id uuid;
  v_user_id uuid;
  v_from public.queue_entry_status;
  v_table public.restaurant_tables;
  v_event public.queue_event_type;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT queue_id INTO v_queue_id
  FROM public.queue_entries
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_ENTRY_NOT_FOUND: Queue entry not found.';
  END IF;

  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = v_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_entry
  FROM public.queue_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_ENTRY_NOT_FOUND: Queue entry not found.';
  END IF;

  SELECT b.restaurant_id INTO v_restaurant_id
  FROM public.branches b
  WHERE b.id = v_queue.branch_id;

  v_user_id := public.assert_queue_operator(v_restaurant_id);
  v_from := v_entry.status;

  IF v_from = p_to_status THEN
    RETURN v_entry;
  END IF;

  IF NOT public.can_transition_queue_status(v_from, p_to_status) THEN
    RAISE EXCEPTION 'QUEUE_INVALID_TRANSITION: That status change is not allowed.';
  END IF;

  IF p_to_status = 'SEATED' THEN
    IF p_table_id IS NULL THEN
      RAISE EXCEPTION 'QUEUE_TABLE_REQUIRED: Select a table to seat this party.';
    END IF;

    SELECT * INTO v_table
    FROM public.restaurant_tables
    WHERE id = p_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUEUE_TABLE_NOT_FOUND: Table not found.';
    END IF;

    IF v_table.branch_id <> v_queue.branch_id THEN
      RAISE EXCEPTION 'QUEUE_TABLE_BRANCH: Table does not belong to this branch.';
    END IF;

    IF v_table.status <> 'AVAILABLE' THEN
      RAISE EXCEPTION 'QUEUE_TABLE_UNAVAILABLE: That table is not available.';
    END IF;

    IF v_table.capacity < v_entry.party_size THEN
      RAISE EXCEPTION 'QUEUE_TABLE_CAPACITY: That table is too small for this party.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.queue_entries seated
      WHERE seated.table_id = v_table.id
        AND seated.status = 'SEATED'
        AND seated.id <> v_entry.id
    ) THEN
      RAISE EXCEPTION 'QUEUE_TABLE_UNAVAILABLE: That table is already assigned.';
    END IF;

    UPDATE public.restaurant_tables
    SET status = 'OCCUPIED'
    WHERE id = v_table.id;

    UPDATE public.queue_entries
    SET
      status = 'SEATED',
      table_id = v_table.id,
      seated_at = v_now
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  ELSIF p_to_status = 'COMPLETED' THEN
    IF v_entry.table_id IS NOT NULL THEN
      UPDATE public.restaurant_tables
      SET status = 'AVAILABLE'
      WHERE id = v_entry.table_id
        AND branch_id = v_queue.branch_id;
    END IF;

    UPDATE public.queue_entries
    SET
      status = 'COMPLETED',
      completed_at = v_now
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  ELSIF p_to_status = 'CALLED' THEN
    UPDATE public.queue_entries
    SET
      status = 'CALLED',
      called_at = COALESCE(called_at, v_now)
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  ELSIF p_to_status = 'SKIPPED' THEN
    UPDATE public.queue_entries
    SET
      status = 'SKIPPED',
      skipped_at = v_now
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  ELSIF p_to_status = 'CANCELLED' THEN
    UPDATE public.queue_entries
    SET
      status = 'CANCELLED',
      cancelled_at = v_now
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  ELSIF p_to_status = 'NO_SHOW' THEN
    UPDATE public.queue_entries
    SET
      status = 'NO_SHOW',
      no_show_at = v_now
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;
  ELSE
    RAISE EXCEPTION 'QUEUE_INVALID_TRANSITION: That status change is not allowed.';
  END IF;

  v_event := p_to_status::text::public.queue_event_type;

  INSERT INTO public.queue_events (
    queue_entry_id,
    event_type,
    metadata,
    created_by
  )
  VALUES (
    v_entry.id,
    v_event,
    jsonb_strip_nulls(
      jsonb_build_object(
        'from', v_from,
        'to', p_to_status,
        'tableId', p_table_id
      )
    ),
    v_user_id
  );

  RETURN v_entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.can_transition_queue_status(
  public.queue_entry_status, public.queue_entry_status
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.format_queue_token(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_business_date(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.branch_resolved_timezone(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_queue_operator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_enqueue_customer(
  uuid, integer, uuid, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_call_next(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_transition_entry(
  uuid, public.queue_entry_status, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_transition_queue_status(
  public.queue_entry_status, public.queue_entry_status
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_queue_token(text, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_business_date(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_enqueue_customer(
  uuid, integer, uuid, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_call_next(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_transition_entry(
  uuid, public.queue_entry_status, uuid
) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: operational insert/update for entries; members can still view
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "queue_entries_insert_member" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_update_member" ON public.queue_entries;

CREATE POLICY "queue_entries_insert_operator"
  ON public.queue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_queue(queue_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
    )
  );

CREATE POLICY "queue_entries_update_operator"
  ON public.queue_entries
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_queue(queue_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_queue(queue_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
    )
  );

DROP POLICY IF EXISTS "queue_events_insert_member" ON public.queue_events;

CREATE POLICY "queue_events_insert_operator"
  ON public.queue_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_queue_entry(queue_entry_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER', 'STAFF']::public.member_role[]
    )
  );

-- Queue configuration updates stay member-scoped; create/delete remain manager+.
-- Status changes are authorized in the service layer with queue.manage.
