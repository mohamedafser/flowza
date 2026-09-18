-- Flowza Phase 5: restaurant settings, operating hours, and special hours.
-- Typed settings (not a JSON blob). Tenant-aware RLS. No open policies.

-- ---------------------------------------------------------------------------
-- Branches: optional timezone override (restaurant timezone is the default)
-- ---------------------------------------------------------------------------
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS use_restaurant_timezone boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- restaurant_settings (1:1 with restaurants)
-- ---------------------------------------------------------------------------
CREATE TABLE public.restaurant_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants (id) ON DELETE CASCADE,
  queue_enabled boolean NOT NULL DEFAULT true,
  default_queue_name text NOT NULL DEFAULT 'Main Queue',
  token_prefix text NOT NULL DEFAULT 'A',
  starting_token_number integer NOT NULL DEFAULT 1,
  default_service_minutes integer NOT NULL DEFAULT 15,
  max_queue_capacity integer,
  allow_walk_ins boolean NOT NULL DEFAULT true,
  allow_self_check_in boolean NOT NULL DEFAULT true,
  allow_manual_entry boolean NOT NULL DEFAULT true,
  show_estimated_wait boolean NOT NULL DEFAULT true,
  show_queue_position boolean NOT NULL DEFAULT true,
  show_party_size boolean NOT NULL DEFAULT true,
  allow_customer_cancel boolean NOT NULL DEFAULT true,
  require_customer_name boolean NOT NULL DEFAULT true,
  require_customer_phone boolean NOT NULL DEFAULT true,
  default_language text NOT NULL DEFAULT 'en',
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  time_format text NOT NULL DEFAULT '12h',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_settings_queue_name_len CHECK (
    char_length(btrim(default_queue_name)) BETWEEN 1 AND 80
  ),
  CONSTRAINT restaurant_settings_token_prefix_format CHECK (
    token_prefix ~ '^[A-Z0-9]{1,8}$'
  ),
  CONSTRAINT restaurant_settings_starting_token_positive CHECK (
    starting_token_number >= 1
  ),
  CONSTRAINT restaurant_settings_service_minutes_positive CHECK (
    default_service_minutes >= 1
  ),
  CONSTRAINT restaurant_settings_capacity_positive CHECK (
    max_queue_capacity IS NULL OR max_queue_capacity >= 1
  ),
  CONSTRAINT restaurant_settings_date_format CHECK (
    date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')
  ),
  CONSTRAINT restaurant_settings_time_format CHECK (
    time_format IN ('12h', '24h')
  ),
  CONSTRAINT restaurant_settings_language CHECK (
    default_language ~ '^[a-z]{2}(-[A-Z]{2})?$'
  )
);

CREATE TRIGGER restaurant_settings_set_updated_at
BEFORE UPDATE ON public.restaurant_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_restaurant_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.restaurant_settings (restaurant_id)
  VALUES (NEW.id)
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_create_settings
AFTER INSERT ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_restaurant_settings();

INSERT INTO public.restaurant_settings (restaurant_id)
SELECT r.id
FROM public.restaurants r
ON CONFLICT (restaurant_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- operating_hours (restaurant defaults when branch_id IS NULL)
-- day_of_week: ISO 8601 (1 = Monday … 7 = Sunday)
-- ---------------------------------------------------------------------------
CREATE TABLE public.operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT operating_hours_day_of_week_range CHECK (day_of_week BETWEEN 1 AND 7)
);

CREATE TRIGGER operating_hours_set_updated_at
BEFORE UPDATE ON public.operating_hours
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX operating_hours_restaurant_day_unique
  ON public.operating_hours (restaurant_id, day_of_week)
  WHERE branch_id IS NULL;

CREATE UNIQUE INDEX operating_hours_branch_day_unique
  ON public.operating_hours (branch_id, day_of_week)
  WHERE branch_id IS NOT NULL;

CREATE INDEX operating_hours_restaurant_id_idx
  ON public.operating_hours (restaurant_id);

CREATE INDEX operating_hours_branch_id_idx
  ON public.operating_hours (branch_id)
  WHERE branch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- operating_periods (multiple lunch/dinner windows per day)
-- ---------------------------------------------------------------------------
CREATE TABLE public.operating_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_hours_id uuid NOT NULL REFERENCES public.operating_hours (id) ON DELETE CASCADE,
  open_time time NOT NULL,
  close_time time NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT operating_periods_time_order CHECK (close_time > open_time),
  CONSTRAINT operating_periods_unique_window UNIQUE (operating_hours_id, open_time, close_time)
);

CREATE TRIGGER operating_periods_set_updated_at
BEFORE UPDATE ON public.operating_periods
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX operating_periods_hours_id_idx
  ON public.operating_periods (operating_hours_id, sort_order, open_time);

-- ---------------------------------------------------------------------------
-- special_hours (holiday / one-off overrides)
-- ---------------------------------------------------------------------------
CREATE TABLE public.special_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE CASCADE,
  date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT true,
  open_time time,
  close_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT special_hours_reason_len CHECK (
    reason IS NULL OR char_length(reason) <= 200
  ),
  CONSTRAINT special_hours_closed_or_open CHECK (
    (
      is_closed = true
      AND open_time IS NULL
      AND close_time IS NULL
    )
    OR (
      is_closed = false
      AND open_time IS NOT NULL
      AND close_time IS NOT NULL
      AND close_time > open_time
    )
  )
);

CREATE TRIGGER special_hours_set_updated_at
BEFORE UPDATE ON public.special_hours
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX special_hours_restaurant_date_unique
  ON public.special_hours (restaurant_id, date)
  WHERE branch_id IS NULL;

CREATE UNIQUE INDEX special_hours_branch_date_unique
  ON public.special_hours (branch_id, date)
  WHERE branch_id IS NOT NULL;

CREATE INDEX special_hours_restaurant_date_idx
  ON public.special_hours (restaurant_id, date);

CREATE INDEX special_hours_branch_date_idx
  ON public.special_hours (branch_id, date)
  WHERE branch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Integrity: hours/special rows must reference a branch of the same restaurant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_hours_branch_restaurant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  branch_restaurant_id uuid;
BEGIN
  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT restaurant_id INTO branch_restaurant_id
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF branch_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'branch not found';
  END IF;

  IF branch_restaurant_id <> NEW.restaurant_id THEN
    RAISE EXCEPTION 'branch must belong to the same restaurant';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER operating_hours_enforce_branch_restaurant
BEFORE INSERT OR UPDATE OF restaurant_id, branch_id ON public.operating_hours
FOR EACH ROW
EXECUTE FUNCTION public.enforce_hours_branch_restaurant();

CREATE TRIGGER special_hours_enforce_branch_restaurant
BEFORE INSERT OR UPDATE OF restaurant_id, branch_id ON public.special_hours
FOR EACH ROW
EXECUTE FUNCTION public.enforce_hours_branch_restaurant();

-- Closed days cannot contain periods; periods cannot overlap.
CREATE OR REPLACE FUNCTION public.enforce_operating_period_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hours_closed boolean;
  overlap_exists boolean;
BEGIN
  SELECT is_closed INTO hours_closed
  FROM public.operating_hours
  WHERE id = NEW.operating_hours_id;

  IF hours_closed IS NULL THEN
    RAISE EXCEPTION 'operating hours not found';
  END IF;

  IF hours_closed THEN
    RAISE EXCEPTION 'closed days cannot contain operating periods';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.operating_periods p
    WHERE p.operating_hours_id = NEW.operating_hours_id
      AND p.id IS DISTINCT FROM NEW.id
      AND p.open_time < NEW.close_time
      AND NEW.open_time < p.close_time
  ) INTO overlap_exists;

  IF overlap_exists THEN
    RAISE EXCEPTION 'operating periods cannot overlap';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER operating_periods_enforce_rules
BEFORE INSERT OR UPDATE OF operating_hours_id, open_time, close_time
ON public.operating_periods
FOR EACH ROW
EXECUTE FUNCTION public.enforce_operating_period_rules();

CREATE OR REPLACE FUNCTION public.enforce_operating_hours_closed_without_periods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_closed = true THEN
    DELETE FROM public.operating_periods
    WHERE operating_hours_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER operating_hours_clear_periods_when_closed
AFTER UPDATE OF is_closed ON public.operating_hours
FOR EACH ROW
WHEN (NEW.is_closed = true AND OLD.is_closed = false)
EXECUTE FUNCTION public.enforce_operating_hours_closed_without_periods();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restaurant_id_for_operating_hours(p_operating_hours_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oh.restaurant_id
  FROM public.operating_hours oh
  WHERE oh.id = p_operating_hours_id;
$$;

REVOKE ALL ON FUNCTION public.restaurant_id_for_operating_hours(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_id_for_operating_hours(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_restaurant_settings() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_hours ENABLE ROW LEVEL SECURITY;

-- restaurant_settings
CREATE POLICY "restaurant_settings_select_member"
  ON public.restaurant_settings
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "restaurant_settings_insert_owner_admin"
  ON public.restaurant_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "restaurant_settings_update_owner_admin"
  ON public.restaurant_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "restaurant_settings_delete_owner"
  ON public.restaurant_settings
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(restaurant_id, ARRAY['OWNER']::public.member_role[])
  );

-- operating_hours
CREATE POLICY "operating_hours_select_member"
  ON public.operating_hours
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "operating_hours_insert_owner_admin"
  ON public.operating_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "operating_hours_update_owner_admin"
  ON public.operating_hours
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "operating_hours_delete_owner_admin"
  ON public.operating_hours
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- operating_periods
CREATE POLICY "operating_periods_select_member"
  ON public.operating_periods
  FOR SELECT
  TO authenticated
  USING (
    public.is_restaurant_member(
      public.restaurant_id_for_operating_hours(operating_hours_id)
    )
  );

CREATE POLICY "operating_periods_insert_owner_admin"
  ON public.operating_periods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_operating_hours(operating_hours_id),
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "operating_periods_update_owner_admin"
  ON public.operating_periods
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_operating_hours(operating_hours_id),
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_operating_hours(operating_hours_id),
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "operating_periods_delete_owner_admin"
  ON public.operating_periods
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_operating_hours(operating_hours_id),
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- special_hours
CREATE POLICY "special_hours_select_member"
  ON public.special_hours
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "special_hours_insert_owner_admin"
  ON public.special_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "special_hours_update_owner_admin"
  ON public.special_hours
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "special_hours_delete_owner_admin"
  ON public.special_hours
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );
