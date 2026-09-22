-- Pending staff invitations.
-- restaurant_members.user_id requires a real auth.users row, so an invite for
-- someone who has not signed up yet is parked here and converted into a
-- membership by an auth.users insert trigger.

CREATE TYPE public.invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REVOKED'
);

CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.member_role NOT NULL DEFAULT 'STAFF',
  status public.invitation_status NOT NULL DEFAULT 'PENDING',
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL
    DEFAULT timezone('utc', now()) + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT organization_invitations_email_normalized
    CHECK (email = lower(btrim(email)) AND email <> '')
);

CREATE TRIGGER organization_invitations_set_updated_at
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- One live invitation per email per tenant; re-inviting reuses the same row.
CREATE UNIQUE INDEX organization_invitations_pending_unique
  ON public.organization_invitations (organization_id, email)
  WHERE status = 'PENDING';

CREATE INDEX organization_invitations_organization_idx
  ON public.organization_invitations (organization_id, status);

CREATE INDEX organization_invitations_email_pending_idx
  ON public.organization_invitations (email)
  WHERE status = 'PENDING';

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Reads are tenant-scoped; every write goes through the RPCs below.
CREATE POLICY "organization_invitations_select_member"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_id));

-- ---------------------------------------------------------------------------
-- Add an existing account, or park an invitation until they sign up
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_organization_member(
  uuid, text, public.member_role
);

-- Composite result so generated types stay accurate after `npm run db:types`.
DROP TYPE IF EXISTS public.invite_member_result CASCADE;

CREATE TYPE public.invite_member_result AS (
  outcome text,
  email text,
  role public.member_role,
  restaurant_id uuid,
  member_id uuid,
  invitation_id uuid,
  expires_at timestamptz
);

CREATE OR REPLACE FUNCTION public.invite_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.member_role
)
RETURNS public.invite_member_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.member_role;
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_user_id uuid;
  v_restaurant_id uuid;
  v_member public.restaurant_members;
  v_invitation public.organization_invitations;
  v_result public.invite_member_result;
BEGIN
  v_actor_id := public.assert_member_manager(p_organization_id);
  v_actor_role := public.current_organization_role(p_organization_id);

  IF v_email = '' THEN
    RAISE EXCEPTION 'MEMBER_VALIDATION: Enter an email address.';
  END IF;

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'MEMBER_VALIDATION: Choose a role for this person.';
  END IF;

  IF p_role = 'OWNER' AND v_actor_role IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'MEMBER_FORBIDDEN: Only an owner can grant the owner role.'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.id INTO v_restaurant_id
  FROM public.restaurants r
  WHERE r.organization_id = p_organization_id
  ORDER BY r.created_at ASC
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND: This organization has no restaurant yet.';
  END IF;

  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
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

    -- A parked invitation for the same address is now redundant.
    UPDATE public.organization_invitations
    SET status = 'ACCEPTED',
        accepted_by = v_user_id,
        accepted_at = timezone('utc', now())
    WHERE organization_id = p_organization_id
      AND email = v_email
      AND status = 'PENDING';

    v_result := ROW(
      'ADDED',
      v_email,
      p_role,
      v_member.restaurant_id,
      v_member.id,
      NULL,
      NULL
    )::public.invite_member_result;

    RETURN v_result;
  END IF;

  INSERT INTO public.organization_invitations (
    organization_id,
    restaurant_id,
    email,
    role,
    invited_by,
    expires_at
  )
  VALUES (
    p_organization_id,
    v_restaurant_id,
    v_email,
    p_role,
    v_actor_id,
    timezone('utc', now()) + interval '14 days'
  )
  ON CONFLICT (organization_id, email) WHERE status = 'PENDING'
  DO UPDATE SET
    role = EXCLUDED.role,
    restaurant_id = EXCLUDED.restaurant_id,
    invited_by = EXCLUDED.invited_by,
    expires_at = EXCLUDED.expires_at
  RETURNING * INTO v_invitation;

  v_result := ROW(
    'INVITED',
    v_email,
    p_role,
    v_invitation.restaurant_id,
    NULL,
    v_invitation.id,
    v_invitation.expires_at
  )::public.invite_member_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- List / revoke pending invitations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_organization_invitations(
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  restaurant_id uuid,
  email text,
  role public.member_role,
  status public.invitation_status,
  invited_by uuid,
  invited_by_name text,
  expires_at timestamptz,
  created_at timestamptz
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
    i.id,
    i.organization_id,
    i.restaurant_id,
    i.email,
    i.role,
    i.status,
    i.invited_by,
    p.full_name,
    i.expires_at,
    i.created_at
  FROM public.organization_invitations i
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.organization_id = p_organization_id
    AND i.status = 'PENDING'
  ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_organization_invitation(
  p_invitation_id uuid
)
RETURNS public.organization_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.organization_invitations;
BEGIN
  SELECT * INTO v_invitation
  FROM public.organization_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND: Invitation not found.';
  END IF;

  PERFORM public.assert_member_manager(v_invitation.organization_id);

  IF v_invitation.status <> 'PENDING' THEN
    RAISE EXCEPTION 'MEMBER_VALIDATION: That invitation is no longer pending.';
  END IF;

  UPDATE public.organization_invitations
  SET status = 'REVOKED'
  WHERE id = v_invitation.id
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$;

-- ---------------------------------------------------------------------------
-- Turn invitations into memberships the moment the account is created.
-- Trigger name sorts after on_auth_user_created so profiles already exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(NEW.email, '')));
  v_invitation public.organization_invitations;
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  FOR v_invitation IN
    SELECT *
    FROM public.organization_invitations
    WHERE email = v_email
      AND status = 'PENDING'
      AND expires_at > timezone('utc', now())
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.restaurant_members (
      restaurant_id,
      organization_id,
      user_id,
      role,
      status
    )
    VALUES (
      v_invitation.restaurant_id,
      v_invitation.organization_id,
      NEW.id,
      v_invitation.role,
      'ACTIVE'
    )
    ON CONFLICT ON CONSTRAINT restaurant_members_restaurant_user_unique
    DO NOTHING;

    UPDATE public.organization_invitations
    SET status = 'ACCEPTED',
        accepted_by = NEW.id,
        accepted_at = timezone('utc', now())
    WHERE id = v_invitation.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_accept_invitations ON auth.users;

CREATE TRIGGER on_auth_user_created_accept_invitations
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.accept_pending_invitations();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.invite_organization_member(
  uuid, text, public.member_role
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_organization_invitations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_organization_invitation(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.invite_organization_member(
  uuid, text, public.member_role
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_organization_invitations(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_organization_invitation(uuid)
  TO authenticated;
