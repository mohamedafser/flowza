-- Ensure assigning a table via queue seating always marks the table OCCUPIED,
-- and releasing a seated party frees it back to AVAILABLE when no longer seated.

CREATE OR REPLACE FUNCTION public.sync_restaurant_table_status_from_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_table_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_previous_table_id := OLD.table_id;

    -- Party became seated (or moved to a different table while seated).
    IF NEW.status = 'SEATED'
      AND NEW.table_id IS NOT NULL
      AND (
        OLD.status IS DISTINCT FROM 'SEATED'
        OR OLD.table_id IS DISTINCT FROM NEW.table_id
      )
    THEN
      IF v_previous_table_id IS NOT NULL
        AND v_previous_table_id IS DISTINCT FROM NEW.table_id
      THEN
        UPDATE public.restaurant_tables
        SET status = 'AVAILABLE'
        WHERE id = v_previous_table_id
          AND status = 'OCCUPIED'
          AND NOT EXISTS (
            SELECT 1
            FROM public.queue_entries e
            WHERE e.table_id = v_previous_table_id
              AND e.status = 'SEATED'
              AND e.id <> NEW.id
          );
      END IF;

      UPDATE public.restaurant_tables
      SET status = 'OCCUPIED'
      WHERE id = NEW.table_id
        AND status IS DISTINCT FROM 'OCCUPIED';
    END IF;

    -- Party left seated status — free the table if nobody else is seated there.
    IF OLD.status = 'SEATED'
      AND NEW.status IS DISTINCT FROM 'SEATED'
      AND OLD.table_id IS NOT NULL
    THEN
      UPDATE public.restaurant_tables
      SET status = 'AVAILABLE'
      WHERE id = OLD.table_id
        AND status = 'OCCUPIED'
        AND NOT EXISTS (
          SELECT 1
          FROM public.queue_entries e
          WHERE e.table_id = OLD.table_id
            AND e.status = 'SEATED'
            AND e.id <> OLD.id
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_entries_sync_table_status ON public.queue_entries;
CREATE TRIGGER queue_entries_sync_table_status
AFTER UPDATE OF status, table_id ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_restaurant_table_status_from_queue();

REVOKE ALL ON FUNCTION public.sync_restaurant_table_status_from_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_restaurant_table_status_from_queue()
  TO service_role;
