-- Flowza staff/roles management for an organization.
-- Membership rows stay on restaurant_members; these RPCs scope them to the tenant
-- and expose the account email (auth.users) that RLS-only reads cannot reach.

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_organization_role(p_organization_id uuid)
RETURNS public.member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rm.role
  FROM public.restaurant_members rm
  INNER JOIN public.restaurants r ON r.id = rm.restaurant_id
  WHERE r.organization_id = p_organization_id
    AND rm.user_id = auth.uid()
    AND rm.status = 'ACTIVE'
  ORDER BY rm.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.assert_member_manager(p_organization_id uuid)
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
    RAISE EXCEPTION 'MEMBER_UNAUTHENTICATED: Sign in to continue.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_organization_role(
    p_organization_id,
    ARRAY['OWNER', 'ADMIN']::public.member_role[]
  ) THEN
    RAISE EXCEPTION 'MEMBER_FORBIDDEN: You do not have permission to manage staff.'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- List members (owner/admin/manager can view; staff has no members.view)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_organization_members(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  organization_id uuid,
  restaurant_id uuid,
  role public.member_role,
  status public.member_status,
  full_name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'MEMBER_UNAUTHENTICATED: Sign in to continue.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_organization_member(p_organization_id) THEN
    RAISE EXCEPTION 'MEMBER_FORBIDDEN: You do not belong to this organization.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    rm.id,
    rm.user_id,
    rm.organization_id,
    rm.restaurant_id,
    rm.role,
    rm.status,
    p.full_name,
    u.email::text,
    rm.created_at,
    rm.updated_at
  FROM public.restaurant_members rm
  INNER JOIN public.restaurants r ON r.id = rm.restaurant_id
  LEFT JOIN public.profiles p ON p.id = rm.user_id
  LEFT JOIN auth.users u ON u.id = rm.user_id
  WHERE r.organization_id = p_organization_id
  ORDER BY
    CASE rm.role
      WHEN 'OWNER' THEN 0
      WHEN 'ADMIN' THEN 1
      WHEN 'MANAGER' THEN 2
      ELSE 3
    END,
    COALESCE(p.full_name, u.email::text, ''),
    rm.created_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- Add an existing Flowza account to this organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.member_role
)
RETURNS public.restaurant_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.member_role;
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_user_id uuid;
  v_restaurant_id uuid;
  v_member public.restaurant_members;
BEGIN
  PERFORM public.assert_member_manager(p_organization_id);
  v_actor_role := public.current_organization_role(p_organization_id);

  IF v_email = '' THEN
    RAISE EXCEPTION 'MEMBER_VALIDATION: Enter the email address of an existing Flowza account.';
  END IF;

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'MEMBER_VALIDATION: Choose a role for this person.';
  END IF;

  IF p_role = 'OWNER' AND v_actor_role IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'MEMBER_FORBIDDEN: Only an owner can grant the owner role.'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NO_ACCOUNT: No Flowza account uses that email. Ask them to sign up first, then add them.';
  END IF;

  SELECT r.id INTO v_restaurant_id
  FROM public.restaurants r
  WHERE r.organization_id = p_organization_id
  ORDER BY r.created_at ASC
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND: This organization has no restaurant yet.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    INNER JOIN public.restaurants r2 ON r2.id = rm.restaurant_id
    WHERE r2.organization_id = p_organization_id
      AND rm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'MEMBER_ALREADY_EXISTS: That person is already part of this organization.';
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.restaurant_members (
    restaurant_id,
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_restaurant_id,
    p_organization_id,
    v_user_id,
    p_role,
    'ACTIVE'
  )
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- ---------------------------------------------------------------------------
-- Change a member's role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_organization_member_role(
  p_member_id uuid,
  p_role public.member_role
)
RETURNS public.restaurant_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.member_role;
  v_member public.restaurant_members;
  v_organization_id uuid;
  v_owner_count integer;
BEGIN
  SELECT rm.* INTO v_member
  FROM public.restaurant_members rm
  WHERE rm.id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND: Staff member not found.';
  END IF;

  v_organization_id := v_member.organization_id;
  v_actor_id := public.assert_member_manager(v_organization_id);
  v_actor_role := public.current_organization_role(v_organization_id);

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'MEMBER_VALIDATION: Choose a role for this person.';
  END IF;

  IF v_member.user_id = v_actor_id THEN
    RAISE EXCEPTION 'MEMBER_SELF: You cannot change your own role.';
  END IF;

  IF (p_role = 'OWNER' OR v_member.role = 'OWNER')
    AND v_actor_role IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'MEMBER_FORBIDDEN: Only an owner can change owner access.'
      USING ERRCODE = '42501';
  END IF;

  IF v_member.role = p_role THEN
    RETURN v_member;
  END IF;

  IF v_member.role = 'OWNER' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.restaurant_members rm
    WHERE rm.organization_id = v_organization_id
      AND rm.role = 'OWNER'
      AND rm.status = 'ACTIVE';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'MEMBER_LAST_OWNER: Every organization needs at least one owner.';
    END IF;
  END IF;

  UPDATE public.restaurant_members
  SET role = p_role
  WHERE id = v_member.id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- ---------------------------------------------------------------------------
-- Remove a member from the organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_organization_member(p_member_id uuid)
RETURNS public.restaurant_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.member_role;
  v_member public.restaurant_members;
  v_organization_id uuid;
  v_owner_count integer;
BEGIN
  SELECT rm.* INTO v_member
  FROM public.restaurant_members rm
  WHERE rm.id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND: Staff member not found.';
  END IF;

  v_organization_id := v_member.organization_id;
  v_actor_id := public.assert_member_manager(v_organization_id);
  v_actor_role := public.current_organization_role(v_organization_id);

  IF v_member.user_id = v_actor_id THEN
    RAISE EXCEPTION 'MEMBER_SELF: You cannot remove yourself from the organization.';
  END IF;

  IF v_member.role = 'OWNER' AND v_actor_role IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'MEMBER_FORBIDDEN: Only an owner can remove another owner.'
      USING ERRCODE = '42501';
  END IF;

  IF v_member.role = 'OWNER' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.restaurant_members rm
    WHERE rm.organization_id = v_organization_id
      AND rm.role = 'OWNER'
      AND rm.status = 'ACTIVE';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'MEMBER_LAST_OWNER: Every organization needs at least one owner.';
    END IF;
  END IF;

  DELETE FROM public.restaurant_members
  WHERE id = v_member.id;

  RETURN v_member;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_organization_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_member_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_organization_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_organization_member(
  uuid, text, public.member_role
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_organization_member_role(
  uuid, public.member_role
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_organization_member(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_organization_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_member_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_organization_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_organization_member(
  uuid, text, public.member_role
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_organization_member_role(
  uuid, public.member_role
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid) TO authenticated;
