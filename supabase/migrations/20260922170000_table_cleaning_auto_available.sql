-- Auto-return CLEANING tables to AVAILABLE after 10 minutes.
-- Manual status changes clear cleaning_started_at so the timer is ignored.

ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS cleaning_started_at timestamptz;

COMMENT ON COLUMN public.restaurant_tables.cleaning_started_at IS
  'Set when status becomes CLEANING; used to auto-release to AVAILABLE after 10 minutes.';

-- Backfill existing cleaning tables from last update time.
UPDATE public.restaurant_tables
SET cleaning_started_at = COALESCE(updated_at, timezone('utc', now()))
WHERE status = 'CLEANING'
  AND cleaning_started_at IS NULL;

CREATE OR REPLACE FUNCTION public.restaurant_tables_track_cleaning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CLEANING'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'CLEANING') THEN
    NEW.cleaning_started_at := timezone('utc', now());
  ELSIF NEW.status IS DISTINCT FROM 'CLEANING' THEN
    NEW.cleaning_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_tables_track_cleaning ON public.restaurant_tables;
CREATE TRIGGER restaurant_tables_track_cleaning
BEFORE INSERT OR UPDATE OF status ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.restaurant_tables_track_cleaning();

CREATE OR REPLACE FUNCTION public.release_expired_cleaning_tables(
  p_branch_id uuid DEFAULT NULL,
  p_minutes integer DEFAULT 10
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_minutes integer := GREATEST(COALESCE(p_minutes, 10), 1);
BEGIN
  UPDATE public.restaurant_tables
  SET status = 'AVAILABLE'
  WHERE status = 'CLEANING'
    AND cleaning_started_at IS NOT NULL
    AND cleaning_started_at <= timezone('utc', now()) - make_interval(mins => v_minutes)
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.restaurant_tables_track_cleaning() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_expired_cleaning_tables(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.release_expired_cleaning_tables(uuid, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_cleaning_tables(uuid, integer)
  TO service_role;

CREATE INDEX IF NOT EXISTS restaurant_tables_cleaning_started_at_idx
  ON public.restaurant_tables (cleaning_started_at)
  WHERE status = 'CLEANING';
