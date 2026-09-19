-- Public QR join: search customers by name/phone without service-role access.
-- Mirrors resolve_public_branch scoping used by get_public_queue_info.

CREATE OR REPLACE FUNCTION public.search_public_queue_customers(
  p_restaurant_slug text,
  p_branch_slug text,
  p_query text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_query text;
  v_pattern text;
BEGIN
  SELECT restaurant_id, branch_id
  INTO v_restaurant_id, v_branch_id
  FROM public.resolve_public_branch(p_restaurant_slug, p_branch_slug);

  IF v_restaurant_id IS NULL OR v_branch_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_query := btrim(COALESCE(p_query, ''));
  IF char_length(v_query) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF char_length(v_query) > 120 THEN
    v_query := left(v_query, 120);
  END IF;

  -- Escape ILIKE wildcards in user input.
  v_pattern :=
    '%' ||
    replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') ||
    '%';

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', c.name,
          'phone', c.phone
        )
        ORDER BY c.name ASC
      )
      FROM (
        SELECT c.name, c.phone
        FROM public.customers c
        WHERE c.restaurant_id = v_restaurant_id
          AND (
            c.name ILIKE v_pattern ESCAPE '\'
            OR COALESCE(c.phone, '') ILIKE v_pattern ESCAPE '\'
          )
        ORDER BY c.name ASC
        LIMIT 5
      ) c
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_queue_customers(text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_queue_customers(text, text, text)
  TO anon, authenticated;
