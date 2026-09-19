-- Phase 13: Notification infrastructure
-- Extends notifications for delivery tracking, preferences, staff read state,
-- and restaurant notification settings. Provider credentials stay in env vars.

-- ---------------------------------------------------------------------------
-- Status enum: PROCESSING + CANCELLED
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'PROCESSING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ---------------------------------------------------------------------------
-- notifications: delivery, idempotency, audience
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_audience_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_audience_check
      CHECK (audience IN ('CUSTOMER', 'STAFF'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_attempts_non_negative'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_attempts_non_negative
      CHECK (attempts >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_idempotency_key_key'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS notifications_restaurant_created_idx
  ON public.notifications (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_restaurant_audience_idx
  ON public.notifications (restaurant_id, audience, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_pending_retry_idx
  ON public.notifications (status, scheduled_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS notifications_branch_id_idx
  ON public.notifications (branch_id);

-- ---------------------------------------------------------------------------
-- Staff read tracking (multi-recipient in-app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_user_id_idx
  ON public.notification_reads (user_id, read_at DESC);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_reads_select_own" ON public.notification_reads;
CREATE POLICY "notification_reads_select_own"
  ON public.notification_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_restaurant_member(
      (
        SELECT n.restaurant_id
        FROM public.notifications n
        WHERE n.id = notification_id
      )
    )
  );

DROP POLICY IF EXISTS "notification_reads_insert_own" ON public.notification_reads;
CREATE POLICY "notification_reads_insert_own"
  ON public.notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_restaurant_member(
      (
        SELECT n.restaurant_id
        FROM public.notifications n
        WHERE n.id = notification_id
      )
    )
  );

DROP POLICY IF EXISTS "notification_reads_delete_own" ON public.notification_reads;
CREATE POLICY "notification_reads_delete_own"
  ON public.notification_reads
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Customer notification preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
  customer_id uuid PRIMARY KEY REFERENCES public.customers (id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  in_app_enabled boolean NOT NULL DEFAULT true,
  notify_queue_joined boolean NOT NULL DEFAULT true,
  notify_queue_called boolean NOT NULL DEFAULT true,
  notify_queue_reminder boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS customer_notification_preferences_set_updated_at
  ON public.customer_notification_preferences;
CREATE TRIGGER customer_notification_preferences_set_updated_at
BEFORE UPDATE ON public.customer_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS customer_notification_preferences_restaurant_idx
  ON public.customer_notification_preferences (restaurant_id);

ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_notification_preferences_select_member"
  ON public.customer_notification_preferences;
CREATE POLICY "customer_notification_preferences_select_member"
  ON public.customer_notification_preferences
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "customer_notification_preferences_insert_member"
  ON public.customer_notification_preferences;
CREATE POLICY "customer_notification_preferences_insert_member"
  ON public.customer_notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "customer_notification_preferences_update_member"
  ON public.customer_notification_preferences;
CREATE POLICY "customer_notification_preferences_update_member"
  ON public.customer_notification_preferences
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "customer_notification_preferences_delete_manager"
  ON public.customer_notification_preferences;
CREATE POLICY "customer_notification_preferences_delete_manager"
  ON public.customer_notification_preferences
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Restaurant notification settings (channel defaults — not provider secrets)
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS notifications_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notifications_whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notifications_sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notifications_in_app_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_customer_on_join boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_customer_on_called boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_customer_on_reminder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_staff_on_join boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_on_cancel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_on_no_show boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_staff_queue_busy_threshold integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_settings_busy_threshold_positive'
  ) THEN
    ALTER TABLE public.restaurant_settings
      ADD CONSTRAINT restaurant_settings_busy_threshold_positive
      CHECK (
        notify_staff_queue_busy_threshold IS NULL
        OR notify_staff_queue_busy_threshold >= 1
      );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Notification RLS (select for members; writes scoped)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_member" ON public.notifications;
CREATE POLICY "notifications_select_member"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "notifications_insert_member" ON public.notifications;
CREATE POLICY "notifications_insert_member"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "notifications_update_member" ON public.notifications;
CREATE POLICY "notifications_update_member"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

DROP POLICY IF EXISTS "notifications_delete_owner_admin" ON public.notifications;
CREATE POLICY "notifications_delete_owner_admin"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Idempotent enqueue + delivery update (SECURITY DEFINER)
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
  p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
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
  UPDATE public.notifications
  SET status = 'PROCESSING'
  WHERE id = p_notification_id
    AND status IN ('PENDING', 'FAILED')
    AND attempts < 3
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_mark_delivery(
  p_notification_id uuid,
  p_status public.notification_status,
  p_provider text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_increment_attempt boolean DEFAULT true
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  UPDATE public.notifications
  SET
    status = p_status,
    provider = COALESCE(p_provider, provider),
    provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
    error_code = CASE
      WHEN p_status = 'SENT' THEN NULL
      ELSE COALESCE(p_error_code, error_code)
    END,
    error_message = CASE
      WHEN p_status = 'SENT' THEN NULL
      ELSE left(COALESCE(p_error_message, error_message), 500)
    END,
    attempts = CASE
      WHEN p_increment_attempt THEN attempts + 1
      ELSE attempts
    END,
    last_attempt_at = timezone('utc', now()),
    sent_at = CASE
      WHEN p_status = 'SENT' THEN timezone('utc', now())
      ELSE sent_at
    END
  WHERE id = p_notification_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_enqueue(
  uuid,
  public.notification_channel,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.notification_mark_delivery(
  uuid,
  public.notification_status,
  text,
  text,
  text,
  text,
  boolean
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.notification_claim(uuid) FROM PUBLIC;

-- Authenticated staff enqueue for queue-triggered STAFF in-app rows.
-- Public/anonymous flows use the service-role client from the app server.
GRANT EXECUTE ON FUNCTION public.notification_enqueue(
  uuid,
  public.notification_channel,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz
) TO service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.notification_mark_delivery(
  uuid,
  public.notification_status,
  text,
  text,
  text,
  text,
  boolean
) TO service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.notification_claim(uuid)
  TO service_role, authenticated;
