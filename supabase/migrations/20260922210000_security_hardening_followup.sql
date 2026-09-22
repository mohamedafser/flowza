-- Phase 18 follow-up: close remaining privilege / public / entitlement gaps
-- Identified by security audit after initial hardening migration.

-- ---------------------------------------------------------------------------
-- 1) Subscriptions: mirror payments — no client writes (service-role only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "subscriptions_insert_owner_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_owner_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_owner" ON public.subscriptions;

-- SELECT for OWNER/ADMIN retained (created in organization_tenancy migration).
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;

-- ---------------------------------------------------------------------------
-- 2) restaurant_members: block direct role / identity escalation
--    SECURITY DEFINER RPCs run as postgres and still succeed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_restaurant_member_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Table-owner / service-role paths (SECURITY DEFINER RPCs, admin jobs).
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Bootstrap first OWNER is allowed via RLS; other inserts must use RPCs.
    IF NEW.role IS DISTINCT FROM 'OWNER'::public.member_role THEN
      RAISE EXCEPTION 'MEMBER_PRIVILEGE: role can only be set via server RPCs'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'MEMBER_PRIVILEGE: cannot create membership for another user'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'MEMBER_PRIVILEGE: membership privileges can only change via server RPCs'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_members_protect_privilege_columns
  ON public.restaurant_members;

CREATE TRIGGER restaurant_members_protect_privilege_columns
BEFORE INSERT OR UPDATE ON public.restaurant_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_restaurant_member_privilege_columns();

REVOKE ALL ON FUNCTION public.protect_restaurant_member_privilege_columns() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3) Organizations: block client plan_id / status privilege changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_organization_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
      OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'ORG_PRIVILEGE: billing fields can only change via server ops'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_protect_billing_columns ON public.organizations;

CREATE TRIGGER organizations_protect_billing_columns
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.protect_organization_billing_columns();

REVOKE ALL ON FUNCTION public.protect_organization_billing_columns() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4) Public customer search: exact phone only (no name directory / raw dump)
-- ---------------------------------------------------------------------------
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
  v_phone text;
BEGIN
  SELECT restaurant_id, branch_id
  INTO v_restaurant_id, v_branch_id
  FROM public.resolve_public_branch(p_restaurant_slug, p_branch_slug);

  IF v_restaurant_id IS NULL OR v_branch_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_query := btrim(COALESCE(p_query, ''));
  IF char_length(v_query) < 8 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF char_length(v_query) > 30 THEN
    v_query := left(v_query, 30);
  END IF;

  -- Phone-only self-lookup. Name ILIKE directory search is removed.
  v_phone := public.normalize_public_phone(v_query);
  IF v_phone IS NULL OR NOT public.is_valid_public_phone(v_phone) THEN
    RETURN '[]'::jsonb;
  END IF;

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
          AND c.phone = v_phone
        ORDER BY c.name ASC
        LIMIT 1
      ) c
    ),
    '[]'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Public join: do not hand out another guest's token without name match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_join_public(
  p_restaurant_slug text,
  p_branch_slug text,
  p_name text,
  p_phone text,
  p_party_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant public.restaurants;
  v_branch public.branches;
  v_queue public.queues;
  v_settings public.restaurant_settings;
  v_timezone text;
  v_business_date date;
  v_name text;
  v_phone text;
  v_customer_id uuid;
  v_customer_name text;
  v_entry public.queue_entries;
  v_reused boolean := false;
  v_existing_id uuid;
  v_restaurant_id uuid;
  v_branch_id uuid;
BEGIN
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Party size must be between 1 and 50.';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Enter a valid name.';
  END IF;

  SELECT restaurant_id, branch_id
  INTO v_restaurant_id, v_branch_id
  FROM public.resolve_public_branch(p_restaurant_slug, p_branch_slug);

  IF v_restaurant_id IS NULL OR v_branch_id IS NULL THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = v_restaurant_id;
  SELECT * INTO v_branch FROM public.branches WHERE id = v_branch_id;

  SELECT * INTO v_queue
  FROM public.pick_public_branch_queue(v_branch.id);

  IF NOT FOUND OR v_queue.id IS NULL THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND: Queue not found.';
  END IF;

  SELECT * INTO v_queue
  FROM public.queues
  WHERE id = v_queue.id
  FOR UPDATE;

  SELECT * INTO v_settings
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant.id;

  IF COALESCE(v_settings.queue_enabled, true) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'QUEUE_DISABLED: Unable to join the queue right now.';
  END IF;

  IF COALESCE(v_settings.allow_self_check_in, true) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'QUEUE_SELF_CHECK_IN_DISABLED: Unable to join the queue right now.';
  END IF;

  IF v_queue.status = 'PAUSED' THEN
    RAISE EXCEPTION 'QUEUE_PAUSED: Queue is temporarily paused. Please try again shortly.';
  END IF;

  IF v_queue.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'QUEUE_CLOSED: Queue is currently closed.';
  END IF;

  IF NOT public.branch_is_open_now(v_branch.id) THEN
    RAISE EXCEPTION 'QUEUE_OUTSIDE_HOURS: This location is currently closed.';
  END IF;

  IF COALESCE(v_settings.require_customer_name, true) AND char_length(v_name) < 1 THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Name is required.';
  END IF;

  v_phone := public.normalize_public_phone(p_phone);
  IF COALESCE(v_settings.require_customer_phone, true) THEN
    IF v_phone IS NULL OR NOT public.is_valid_public_phone(v_phone) THEN
      RAISE EXCEPTION 'QUEUE_VALIDATION: Enter a valid phone number.';
    END IF;
  ELSIF v_phone IS NOT NULL AND NOT public.is_valid_public_phone(v_phone) THEN
    RAISE EXCEPTION 'QUEUE_VALIDATION: Enter a valid phone number.';
  END IF;

  v_timezone := public.branch_resolved_timezone(v_branch.id);
  v_business_date := public.queue_business_date(v_timezone);

  IF v_phone IS NOT NULL THEN
    SELECT id, name INTO v_customer_id, v_customer_name
    FROM public.customers
    WHERE restaurant_id = v_restaurant.id
      AND phone = v_phone
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    BEGIN
      INSERT INTO public.customers (restaurant_id, name, phone)
      VALUES (v_restaurant.id, v_name, v_phone)
      RETURNING id, name INTO v_customer_id, v_customer_name;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT id, name INTO v_customer_id, v_customer_name
        FROM public.customers
        WHERE restaurant_id = v_restaurant.id
          AND phone = v_phone
        LIMIT 1;

        IF v_customer_id IS NULL THEN
          RAISE EXCEPTION 'QUEUE_UNKNOWN: Unable to join the queue. Please try again.';
        END IF;
    END;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.queue_entries
  WHERE queue_id = v_queue.id
    AND customer_id = v_customer_id
    AND business_date = v_business_date
    AND status IN ('WAITING', 'CALLED', 'SEATED')
  LIMIT 1;

  -- Reuse path: require matching name before returning the bearer access token.
  IF v_existing_id IS NOT NULL THEN
    IF lower(btrim(COALESCE(v_customer_name, ''))) IS DISTINCT FROM lower(v_name) THEN
      RAISE EXCEPTION
        'QUEUE_CONFLICT: This phone is already in today''s queue. Use your status link, or enter the same name used when joining.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  v_entry := public.queue_insert_waiting_entry(
    v_queue.id,
    v_customer_id,
    p_party_size,
    v_business_date,
    v_settings.max_queue_capacity,
    NULL
  );

  v_reused := v_existing_id IS NOT NULL;

  RETURN jsonb_build_object(
    'access_token', v_entry.public_access_token,
    'reused', v_reused,
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
    'entry', jsonb_build_object(
      'id', v_entry.id,
      'token', v_entry.token,
      'status', v_entry.status,
      'party_size', v_entry.party_size,
      'joined_at', v_entry.joined_at,
      'table_number', NULL,
      'table_name', NULL
    ),
    'peers', public.public_queue_peer_payload(v_queue.id, v_business_date)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Notification DEFINER RPCs: require membership or service role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_enqueue(
  p_restaurant_id uuid,
  p_channel public.notification_channel,
  p_type text,
  p_recipient text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_queue_entry_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_audience text DEFAULT 'CUSTOMER',
  p_idempotency_key text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  IF auth.uid() IS NOT NULL
    AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
    AND NOT public.is_restaurant_member(p_restaurant_id) THEN
    RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN: Not a restaurant member.'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL
    AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN: Not authenticated.'
      USING ERRCODE = '42501';
  END IF;

  IF p_restaurant_id IS NULL OR p_channel IS NULL OR p_type IS NULL OR p_recipient IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_VALIDATION: Missing required fields.';
  END IF;

  IF p_audience IS DISTINCT FROM 'CUSTOMER' AND p_audience IS DISTINCT FROM 'STAFF' THEN
    RAISE EXCEPTION 'NOTIFICATION_VALIDATION: Invalid audience.';
  END IF;

  IF jsonb_typeof(COALESCE(p_payload, '{}'::jsonb)) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'NOTIFICATION_VALIDATION: Payload must be an object.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.notifications
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.notifications (
      restaurant_id,
      customer_id,
      queue_entry_id,
      reservation_id,
      branch_id,
      channel,
      type,
      status,
      recipient,
      payload,
      audience,
      idempotency_key,
      title,
      body,
      provider,
      scheduled_at
    )
    VALUES (
      p_restaurant_id,
      p_customer_id,
      p_queue_entry_id,
      p_reservation_id,
      p_branch_id,
      p_channel,
      p_type,
      'PENDING',
      p_recipient,
      COALESCE(p_payload, '{}'::jsonb),
      p_audience,
      p_idempotency_key,
      p_title,
      p_body,
      p_provider,
      p_scheduled_at
    )
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_row
        FROM public.notifications
        WHERE idempotency_key = p_idempotency_key;
      ELSE
        RAISE;
      END IF;
  END;

  RETURN v_row;
END;
$$;

-- Older overload without reservation_id (keep grants consistent if present).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'notification_enqueue'
      AND pg_get_function_identity_arguments(p.oid) =
        'uuid, public.notification_channel, text, text, jsonb, uuid, uuid, uuid, text, text, text, text, text, timestamptz'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.notification_enqueue(
        p_restaurant_id uuid,
        p_channel public.notification_channel,
        p_type text,
        p_recipient text,
        p_payload jsonb DEFAULT '{}'::jsonb,
        p_customer_id uuid DEFAULT NULL,
        p_queue_entry_id uuid DEFAULT NULL,
        p_branch_id uuid DEFAULT NULL,
        p_audience text DEFAULT 'CUSTOMER',
        p_idempotency_key text DEFAULT NULL,
        p_title text DEFAULT NULL,
        p_body text DEFAULT NULL,
        p_provider text DEFAULT NULL,
        p_scheduled_at timestamptz DEFAULT NULL
      )
      RETURNS public.notifications
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT public.notification_enqueue(
          p_restaurant_id,
          p_channel,
          p_type,
          p_recipient,
          p_payload,
          p_customer_id,
          p_queue_entry_id,
          p_branch_id,
          p_audience,
          p_idempotency_key,
          p_title,
          p_body,
          p_provider,
          p_scheduled_at,
          NULL
        );
      $body$;
    $fn$;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_claim(
  p_notification_id uuid
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN: Not authenticated.'
        USING ERRCODE = '42501';
    END IF;

    SELECT n.* INTO v_row
    FROM public.notifications n
    WHERE n.id = p_notification_id;

    IF NOT FOUND OR NOT public.is_restaurant_member(v_row.restaurant_id) THEN
      RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN: Not a restaurant member.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.notifications
  SET status = 'PROCESSING'
  WHERE id = p_notification_id
    AND status IN ('PENDING', 'FAILED')
    AND attempts < 3
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Defense in depth for sensitive system tables
REVOKE ALL ON TABLE public.webhook_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO service_role;
