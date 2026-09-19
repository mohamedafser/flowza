-- Phase 14: Reservations & Walk-ins
-- Extends reservations lifecycle, table/queue linking, codes, open-at helper,
-- conflict prevention, and realtime publication.
--
-- Requires 20260919135000_reservation_status_arrived (ARRIVED must already be
-- committed before this migration references it).

-- ---------------------------------------------------------------------------
-- reservations: operational columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS reservation_code text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.restaurant_tables (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS special_requests text,
  ADD COLUMN IF NOT EXISTS cancelled_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS seated_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_duration_minutes_positive'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_duration_minutes_positive
      CHECK (duration_minutes >= 15 AND duration_minutes <= 480);
  END IF;
END
$$;

-- Backfill end_time from duration when missing
UPDATE public.reservations
SET end_time = (start_time + make_interval(mins => duration_minutes))::time
WHERE end_time IS NULL;

-- ---------------------------------------------------------------------------
-- Reservation code counters (restaurant-scoped, concurrency-safe)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_code_counters (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants (id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1001,
  CONSTRAINT reservation_code_counters_next_positive CHECK (next_number >= 1)
);

ALTER TABLE public.reservation_code_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_code_counters_select_member"
  ON public.reservation_code_counters;
CREATE POLICY "reservation_code_counters_select_member"
  ON public.reservation_code_counters
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

-- No direct insert/update/delete for authenticated — allocation via SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.allocate_reservation_code(p_restaurant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_VALIDATION: Restaurant is required.';
  END IF;

  INSERT INTO public.reservation_code_counters (restaurant_id, next_number)
  VALUES (p_restaurant_id, 1002)
  ON CONFLICT (restaurant_id) DO UPDATE
    SET next_number = public.reservation_code_counters.next_number + 1
  RETURNING next_number - 1 INTO v_number;

  RETURN 'RES-' || v_number::text;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_reservation_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_reservation_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_reservation_code(uuid) TO service_role;

-- Unique code per branch (tenant-safe; codes allocated per restaurant)
CREATE UNIQUE INDEX IF NOT EXISTS reservations_branch_code_unique
  ON public.reservations (branch_id, reservation_code)
  WHERE reservation_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservations_table_id_idx
  ON public.reservations (table_id)
  WHERE table_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservations_branch_date_status_idx
  ON public.reservations (branch_id, reservation_date, status);

CREATE INDEX IF NOT EXISTS reservations_code_idx
  ON public.reservations (reservation_code)
  WHERE reservation_code IS NOT NULL;

-- Active statuses that hold a table booking slot
CREATE INDEX IF NOT EXISTS reservations_active_table_overlap_idx
  ON public.reservations (branch_id, table_id, reservation_date, start_time)
  WHERE table_id IS NOT NULL
    AND status IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED');

-- ---------------------------------------------------------------------------
-- Table must belong to the same branch as the reservation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_reservation_table_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_branch_id uuid;
BEGIN
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT branch_id INTO v_table_branch_id
  FROM public.restaurant_tables
  WHERE id = NEW.table_id;

  IF v_table_branch_id IS NULL THEN
    RAISE EXCEPTION 'reservation table not found';
  END IF;

  IF v_table_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'reservation table must belong to the same branch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_enforce_table_branch ON public.reservations;
CREATE TRIGGER reservations_enforce_table_branch
BEFORE INSERT OR UPDATE OF branch_id, table_id ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reservation_table_branch();

-- ---------------------------------------------------------------------------
-- queue_entries.reservation_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS reservation_id uuid
    REFERENCES public.reservations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS queue_entries_reservation_id_idx
  ON public.queue_entries (reservation_id)
  WHERE reservation_id IS NOT NULL;

-- At most one active queue entry per reservation
CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_active_reservation_unique
  ON public.queue_entries (reservation_id)
  WHERE reservation_id IS NOT NULL
    AND status IN ('WAITING', 'CALLED', 'SEATED');

-- ---------------------------------------------------------------------------
-- notifications.reservation_id (optional link)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reservation_id uuid
    REFERENCES public.reservations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notifications_reservation_id_idx
  ON public.notifications (reservation_id)
  WHERE reservation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- branch_is_open_at — same resolution as branch_is_open_now, for a moment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.branch_is_open_at(
  p_branch_id uuid,
  p_at timestamptz
)
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
  IF p_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
  FROM public.branches
  WHERE id = p_branch_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_timezone := public.branch_resolved_timezone(p_branch_id);
  v_local := timezone(v_timezone, p_at);
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

REVOKE ALL ON FUNCTION public.branch_is_open_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.branch_is_open_at(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.branch_is_open_at(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.branch_is_open_at(uuid, timestamptz) TO anon;

CREATE OR REPLACE FUNCTION public.branch_is_open_now(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.branch_is_open_at(p_branch_id, timezone('utc', now()));
$$;

-- ---------------------------------------------------------------------------
-- Extend notification_enqueue with reservation_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_enqueue(
  p_restaurant_id uuid,
  p_channel public.notification_channel,
  p_type text,
  p_recipient text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_queue_entry_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_audience text DEFAULT 'CUSTOMER',
  p_idempotency_key text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  IF p_restaurant_id IS NULL OR p_channel IS NULL OR p_type IS NULL OR p_recipient IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_VALIDATION: Missing required fields.';
  END IF;

  IF p_audience IS DISTINCT FROM 'CUSTOMER' AND p_audience IS DISTINCT FROM 'STAFF' THEN
    RAISE EXCEPTION 'NOTIFICATION_VALIDATION: Invalid audience.';
  END IF;

  IF jsonb_typeof(COALESCE(p_payload, '{}'::jsonb)) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'NOTIFICATION_VALIDATION: Payload must be an object.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.notifications
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.notifications (
      restaurant_id,
      customer_id,
      queue_entry_id,
      reservation_id,
      branch_id,
      channel,
      type,
      status,
      recipient,
      payload,
      audience,
      idempotency_key,
      title,
      body,
      provider,
      scheduled_at
    )
    VALUES (
      p_restaurant_id,
      p_customer_id,
      p_queue_entry_id,
      p_reservation_id,
      p_branch_id,
      p_channel,
      p_type,
      'PENDING',
      p_recipient,
      COALESCE(p_payload, '{}'::jsonb),
      p_audience,
      p_idempotency_key,
      p_title,
      p_body,
      p_provider,
      p_scheduled_at
    )
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_row
        FROM public.notifications
        WHERE idempotency_key = p_idempotency_key;
      ELSE
        RAISE;
      END IF;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_enqueue(
  uuid,
  public.notification_channel,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_enqueue(
  uuid,
  public.notification_channel,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Conflict check helper (overlapping active reservations for a table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservation_table_has_conflict(
  p_branch_id uuid,
  p_table_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.branch_id = p_branch_id
      AND r.table_id = p_table_id
      AND r.reservation_date = p_date
      AND r.status IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED')
      AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
      AND r.start_time < COALESCE(p_end, r.start_time + interval '90 minutes')
      AND COALESCE(r.end_time, r.start_time + interval '90 minutes') > p_start
  );
$$;

REVOKE ALL ON FUNCTION public.reservation_table_has_conflict(
  uuid, uuid, date, time, time, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservation_table_has_conflict(
  uuid, uuid, date, time, time, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservation_table_has_conflict(
  uuid, uuid, date, time, time, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic reservation status transition (row lock + validation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservation_transition(
  p_reservation_id uuid,
  p_to_status public.reservation_status,
  p_table_id uuid DEFAULT NULL,
  p_cancelled_reason text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.reservations;
  v_branch public.branches;
  v_restaurant_id uuid;
  v_user_id uuid;
  v_table public.restaurant_tables;
  v_allowed boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_UNAUTHORIZED: Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Reservation not found.';
  END IF;

  SELECT * INTO v_branch
  FROM public.branches
  WHERE id = v_row.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Branch not found.';
  END IF;

  v_restaurant_id := v_branch.restaurant_id;

  IF NOT public.is_restaurant_member(v_restaurant_id) THEN
    RAISE EXCEPTION 'RESERVATION_FORBIDDEN: Not a restaurant member.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.status = p_to_status THEN
    RETURN v_row;
  END IF;

  v_allowed := CASE v_row.status
    WHEN 'PENDING' THEN p_to_status IN ('CONFIRMED', 'CANCELLED')
    WHEN 'CONFIRMED' THEN p_to_status IN ('ARRIVED', 'CANCELLED', 'NO_SHOW')
    WHEN 'ARRIVED' THEN p_to_status IN ('SEATED', 'CANCELLED', 'NO_SHOW')
    WHEN 'SEATED' THEN p_to_status IN ('COMPLETED')
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'RESERVATION_INVALID_TRANSITION: Cannot change from % to %.',
      v_row.status, p_to_status;
  END IF;

  IF p_to_status = 'SEATED' THEN
    IF p_table_id IS NULL AND v_row.table_id IS NULL THEN
      RAISE EXCEPTION 'RESERVATION_TABLE_REQUIRED: Table is required to seat.';
    END IF;

    SELECT * INTO v_table
    FROM public.restaurant_tables
    WHERE id = COALESCE(p_table_id, v_row.table_id)
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'RESERVATION_TABLE_NOT_FOUND: Table not found.';
    END IF;

    IF v_table.branch_id <> v_row.branch_id THEN
      RAISE EXCEPTION 'RESERVATION_FORBIDDEN: Table does not belong to this branch.'
        USING ERRCODE = '42501';
    END IF;

    IF v_table.status = 'BLOCKED' THEN
      RAISE EXCEPTION 'RESERVATION_TABLE_UNAVAILABLE: Table is blocked.';
    END IF;

    IF v_table.capacity < v_row.party_size THEN
      RAISE EXCEPTION 'RESERVATION_TABLE_CAPACITY: Table cannot seat this party.';
    END IF;

    IF v_table.status = 'OCCUPIED' AND v_row.table_id IS DISTINCT FROM v_table.id THEN
      RAISE EXCEPTION 'RESERVATION_TABLE_UNAVAILABLE: Table is occupied.';
    END IF;

    IF public.reservation_table_has_conflict(
      v_row.branch_id,
      v_table.id,
      v_row.reservation_date,
      v_row.start_time,
      COALESCE(v_row.end_time, (v_row.start_time + make_interval(mins => v_row.duration_minutes))::time),
      v_row.id
    ) THEN
      RAISE EXCEPTION 'RESERVATION_CONFLICT: Table is already reserved for this time.';
    END IF;

    UPDATE public.restaurant_tables
    SET status = 'OCCUPIED'
    WHERE id = v_table.id;

    v_row.table_id := v_table.id;
    v_row.seated_at := timezone('utc', now());
  END IF;

  IF p_to_status = 'COMPLETED' THEN
    v_row.completed_at := timezone('utc', now());
    IF v_row.table_id IS NOT NULL THEN
      UPDATE public.restaurant_tables
      SET status = 'CLEANING'
      WHERE id = v_row.table_id
        AND status = 'OCCUPIED';
    END IF;
  END IF;

  IF p_to_status = 'CONFIRMED' THEN
    v_row.confirmed_at := timezone('utc', now());
  END IF;

  IF p_to_status = 'ARRIVED' THEN
    v_row.arrived_at := timezone('utc', now());
  END IF;

  IF p_to_status = 'CANCELLED' THEN
    v_row.cancelled_at := timezone('utc', now());
    v_row.cancelled_reason := NULLIF(btrim(COALESCE(p_cancelled_reason, '')), '');
    IF v_row.table_id IS NOT NULL AND v_row.status <> 'SEATED' THEN
      -- Release future hold only; seated tables stay occupied until completed.
      IF EXISTS (
        SELECT 1
        FROM public.restaurant_tables t
        WHERE t.id = v_row.table_id
          AND t.status = 'RESERVED'
      ) THEN
        UPDATE public.restaurant_tables
        SET status = 'AVAILABLE'
        WHERE id = v_row.table_id
          AND status = 'RESERVED';
      END IF;
      v_row.table_id := NULL;
    END IF;
  END IF;

  IF p_to_status = 'NO_SHOW' THEN
    v_row.no_show_at := timezone('utc', now());
    IF v_row.table_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.restaurant_tables t
        WHERE t.id = v_row.table_id
          AND t.status = 'RESERVED'
      ) THEN
        UPDATE public.restaurant_tables
        SET status = 'AVAILABLE'
        WHERE id = v_row.table_id
          AND status = 'RESERVED';
      END IF;
      v_row.table_id := NULL;
    END IF;
  END IF;

  UPDATE public.reservations
  SET
    status = p_to_status,
    table_id = v_row.table_id,
    confirmed_at = v_row.confirmed_at,
    arrived_at = v_row.arrived_at,
    seated_at = v_row.seated_at,
    completed_at = v_row.completed_at,
    cancelled_at = v_row.cancelled_at,
    cancelled_reason = v_row.cancelled_reason,
    no_show_at = v_row.no_show_at
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.reservation_transition(
  uuid, public.reservation_status, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservation_transition(
  uuid, public.reservation_status, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservation_transition(
  uuid, public.reservation_status, uuid, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- Realtime: publish reservations (identifiers only via postgres_changes)
-- ---------------------------------------------------------------------------
SELECT public.add_table_to_realtime_publication('public.reservations');

ALTER TABLE public.reservations REPLICA IDENTITY FULL;
