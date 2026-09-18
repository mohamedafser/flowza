-- Phase 4 fix: atomic restaurant onboarding RPC + table grants for authenticated
-- Fixes RLS bootstrap failures that surface as "permission denied" on create.

-- ---------------------------------------------------------------------------
-- Ensure authenticated can use application tables (RLS still enforces tenancy)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ---------------------------------------------------------------------------
-- Atomic create restaurant + OWNER membership (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_name text,
  p_slug text,
  p_email text,
  p_phone text,
  p_website text,
  p_description text,
  p_currency text,
  p_timezone text
)
RETURNS public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_restaurant public.restaurants;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent onboarding: if the user already belongs to a restaurant, return it.
  SELECT r.*
  INTO v_restaurant
  FROM public.restaurants r
  INNER JOIN public.restaurant_members rm
    ON rm.restaurant_id = r.id
  WHERE rm.user_id = v_user_id
    AND rm.status = 'ACTIVE'
  ORDER BY rm.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_restaurant;
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.restaurants (
    name,
    slug,
    email,
    phone,
    website,
    description,
    currency,
    timezone,
    status
  )
  VALUES (
    p_name,
    p_slug,
    p_email,
    p_phone,
    p_website,
    p_description,
    p_currency,
    p_timezone,
    'ACTIVE'
  )
  RETURNING * INTO v_restaurant;

  INSERT INTO public.restaurant_members (
    restaurant_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_restaurant.id,
    v_user_id,
    'OWNER',
    'ACTIVE'
  );

  RETURN v_restaurant;
END;
$$;

REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, text
) TO authenticated;

-- Harden membership bootstrap policy (explicit table alias; clearer first-owner rule)
DROP POLICY IF EXISTS "restaurant_members_insert_owner_admin" ON public.restaurant_members;

CREATE POLICY "restaurant_members_insert_owner_admin"
  ON public.restaurant_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
    OR (
      role = 'OWNER'
      AND user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.restaurant_members existing
        WHERE existing.restaurant_id = restaurant_members.restaurant_id
      )
    )
  );
