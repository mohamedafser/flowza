-- Remove currency and default language from the application schema.

-- Recreate onboarding RPC without currency.
DROP FUNCTION IF EXISTS public.create_restaurant_with_owner(
  text, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_name text,
  p_slug text,
  p_email text,
  p_phone text,
  p_website text,
  p_description text,
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
  text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(
  text, text, text, text, text, text, text
) TO authenticated;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_currency_format;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS currency;

ALTER TABLE public.restaurant_settings
  DROP CONSTRAINT IF EXISTS restaurant_settings_language;

ALTER TABLE public.restaurant_settings
  DROP COLUMN IF EXISTS default_language;
