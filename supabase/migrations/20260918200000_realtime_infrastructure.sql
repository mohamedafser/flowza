-- Flowza Phase 10: Supabase Realtime publication, replica identity, and
-- sanitized public queue broadcasts.
--
-- Staff clients subscribe to postgres_changes. RLS on the source tables is
-- the authorization boundary (restaurant membership). Replica identity FULL
-- is required so UPDATE/DELETE payloads work with RLS.
--
-- Public guests never receive postgres_changes on queue_entries or customers.
-- They subscribe to a public Broadcast topic whose payload is only { source }.
-- Authoritative guest status still comes from get_public_queue_status (access
-- token). Access tokens, names, phones, and emails are never broadcast.
--
-- customers is intentionally NOT added to supabase_realtime.

-- ---------------------------------------------------------------------------
-- Publication helpers (idempotent; safe on fresh and existing databases)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_table_to_realtime_publication(p_table regclass)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema text;
  v_name text;
BEGIN
  SELECT n.nspname, c.relname
  INTO v_schema, v_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_table;

  IF v_schema IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'Unknown table %', p_table;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = v_schema
      AND tablename = v_name
  ) THEN
    EXECUTE format(
      'ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',
      v_schema,
      v_name
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.add_table_to_realtime_publication(regclass) FROM PUBLIC, anon, authenticated;

SELECT public.add_table_to_realtime_publication('public.queue_entries');
SELECT public.add_table_to_realtime_publication('public.queue_events');
SELECT public.add_table_to_realtime_publication('public.queues');
SELECT public.add_table_to_realtime_publication('public.restaurant_tables');

ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
ALTER TABLE public.queue_events REPLICA IDENTITY FULL;
ALTER TABLE public.queues REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- Deterministic public/staff queue topic (never includes tokens or PII)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_realtime_topic(
  p_restaurant_id uuid,
  p_queue_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_restaurant_id IS NULL OR p_queue_id IS NULL THEN NULL
    ELSE 'restaurant:' || p_restaurant_id::text || ':queue:' || p_queue_id::text
  END;
$$;

REVOKE ALL ON FUNCTION public.queue_realtime_topic(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_realtime_topic(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.table_realtime_topic(
  p_restaurant_id uuid,
  p_branch_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_restaurant_id IS NULL OR p_branch_id IS NULL THEN NULL
    ELSE 'restaurant:' || p_restaurant_id::text || ':branch:' || p_branch_id::text || ':tables'
  END;
$$;

REVOKE ALL ON FUNCTION public.table_realtime_topic(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sanitized Broadcast for public customer status pages
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_queue_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id uuid;
  v_restaurant_id uuid;
  v_topic text;
  v_source text := TG_TABLE_NAME;
BEGIN
  -- Realtime must never block queue mutations.
  BEGIN
    IF TG_TABLE_NAME = 'queues' THEN
      v_queue_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'queue_entries' THEN
      v_queue_id := COALESCE(NEW.queue_id, OLD.queue_id);
    ELSIF TG_TABLE_NAME = 'queue_events' THEN
      SELECT e.queue_id
      INTO v_queue_id
      FROM public.queue_entries e
      WHERE e.id = COALESCE(NEW.queue_entry_id, OLD.queue_entry_id);
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;

    IF v_queue_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT b.restaurant_id
    INTO v_restaurant_id
    FROM public.queues q
    JOIN public.branches b ON b.id = q.branch_id
    WHERE q.id = v_queue_id;

    IF v_restaurant_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    v_topic :=
      'restaurant:' || v_restaurant_id::text || ':queue:' || v_queue_id::text;

    BEGIN
      EXECUTE 'SELECT realtime.send($1, $2, $3, false)'
      USING jsonb_build_object('source', v_source), 'queue_changed', v_topic;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_queue_realtime_signal() FROM anon;
GRANT EXECUTE ON FUNCTION public.broadcast_queue_realtime_signal() TO PUBLIC;

DROP TRIGGER IF EXISTS queue_entries_broadcast_realtime ON public.queue_entries;
CREATE TRIGGER queue_entries_broadcast_realtime
AFTER INSERT OR UPDATE OR DELETE ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_queue_realtime_signal();

DROP TRIGGER IF EXISTS queues_broadcast_realtime ON public.queues;
CREATE TRIGGER queues_broadcast_realtime
AFTER INSERT OR UPDATE OR DELETE ON public.queues
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_queue_realtime_signal();

DROP TRIGGER IF EXISTS queue_events_broadcast_realtime ON public.queue_events;
CREATE TRIGGER queue_events_broadcast_realtime
AFTER INSERT ON public.queue_events
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_queue_realtime_signal();

-- ---------------------------------------------------------------------------
-- Public status payload: channel name only (no extra PII, no access token)
-- cancel_public_queue_entry already returns get_public_queue_status().
-- ---------------------------------------------------------------------------
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
    'realtime_channel', public.queue_realtime_topic(v_restaurant.id, v_queue.id),
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
