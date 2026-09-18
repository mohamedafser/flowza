-- Repair: authenticated queue enqueue/create must not be aborted by realtime.
-- Trigger functions need EXECUTE for the role performing INSERT/UPDATE.
-- RETURNS trigger, so granting EXECUTE to PUBLIC is safe (not a callable RPC).

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

REVOKE ALL ON FUNCTION public.broadcast_queue_realtime_signal() FROM anon;
GRANT EXECUTE ON FUNCTION public.broadcast_queue_realtime_signal() TO PUBLIC;

-- Hosted Supabase installs pgcrypto in `extensions`, not `public`.
-- queue_insert_waiting_entry calls this under search_path=public, so the
-- helper must include extensions or gen_random_bytes is missing (42883).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

REVOKE ALL ON FUNCTION public.generate_queue_access_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_queue_access_token()
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.queue_insert_waiting_entry(
  uuid, uuid, integer, date, integer, uuid
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.format_queue_token(text, integer, integer)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.assert_queue_operator(uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.queue_enqueue_customer(
  uuid, integer, uuid, text, text, text
) TO authenticated, service_role;
