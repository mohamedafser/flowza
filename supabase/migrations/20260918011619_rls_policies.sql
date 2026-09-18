-- Flowza Phase 2: Row Level Security foundation
-- Principle: auth.uid() → restaurant_members → restaurant_id (no open policies)
-- Public guest/TV access is deferred to server endpoints / RPCs in later phases.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER; locked search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_restaurant_member(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.user_id = auth.uid()
      AND rm.status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(
  p_restaurant_id uuid,
  p_roles public.member_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.user_id = auth.uid()
      AND rm.status = 'ACTIVE'
      AND rm.role = ANY (p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.restaurant_id_for_branch(p_branch_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.restaurant_id
  FROM public.branches b
  WHERE b.id = p_branch_id;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_id_for_queue(p_queue_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.restaurant_id
  FROM public.queues q
  JOIN public.branches b ON b.id = q.branch_id
  WHERE q.id = p_queue_id;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_id_for_queue_entry(p_queue_entry_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.restaurant_id
  FROM public.queue_entries qe
  JOIN public.queues q ON q.id = qe.queue_id
  JOIN public.branches b ON b.id = q.branch_id
  WHERE qe.id = p_queue_entry_id;
$$;

CREATE OR REPLACE FUNCTION public.is_branch_member(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_restaurant_member(public.restaurant_id_for_branch(p_branch_id));
$$;

REVOKE ALL ON FUNCTION public.is_restaurant_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_restaurant_role(uuid, public.member_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurant_id_for_branch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurant_id_for_queue(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restaurant_id_for_queue_entry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_branch_member(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_restaurant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_restaurant_role(uuid, public.member_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_id_for_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_id_for_queue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_id_for_queue_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_branch_member(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on all application tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.displays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
CREATE POLICY "restaurants_select_member"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(id));

CREATE POLICY "restaurants_insert_authenticated"
  ON public.restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "restaurants_update_owner_admin"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (public.has_restaurant_role(id, ARRAY['OWNER', 'ADMIN']::public.member_role[]))
  WITH CHECK (public.has_restaurant_role(id, ARRAY['OWNER', 'ADMIN']::public.member_role[]));

CREATE POLICY "restaurants_delete_owner"
  ON public.restaurants
  FOR DELETE
  TO authenticated
  USING (public.has_restaurant_role(id, ARRAY['OWNER']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- restaurant_members
-- ---------------------------------------------------------------------------
CREATE POLICY "restaurant_members_select_member"
  ON public.restaurant_members
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

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
      -- Allow bootstrap: first OWNER membership for a restaurant the user just created
      role = 'OWNER'
      AND user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.restaurant_members existing
        WHERE existing.restaurant_id = restaurant_members.restaurant_id
      )
    )
  );

CREATE POLICY "restaurant_members_update_owner_admin"
  ON public.restaurant_members
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

CREATE POLICY "restaurant_members_delete_owner_admin"
  ON public.restaurant_members
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
    OR user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------------
CREATE POLICY "branches_select_member"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "branches_insert_manager_up"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "branches_update_manager_up"
  ON public.branches
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

CREATE POLICY "branches_delete_owner_admin"
  ON public.branches
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- table_sections
-- ---------------------------------------------------------------------------
CREATE POLICY "table_sections_select_member"
  ON public.table_sections
  FOR SELECT
  TO authenticated
  USING (public.is_branch_member(branch_id));

CREATE POLICY "table_sections_insert_manager_up"
  ON public.table_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "table_sections_update_manager_up"
  ON public.table_sections
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "table_sections_delete_manager_up"
  ON public.table_sections
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- restaurant_tables
-- ---------------------------------------------------------------------------
CREATE POLICY "restaurant_tables_select_member"
  ON public.restaurant_tables
  FOR SELECT
  TO authenticated
  USING (public.is_branch_member(branch_id));

CREATE POLICY "restaurant_tables_insert_staff_up"
  ON public.restaurant_tables
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_branch_member(branch_id));

CREATE POLICY "restaurant_tables_update_staff_up"
  ON public.restaurant_tables
  FOR UPDATE
  TO authenticated
  USING (public.is_branch_member(branch_id))
  WITH CHECK (public.is_branch_member(branch_id));

CREATE POLICY "restaurant_tables_delete_manager_up"
  ON public.restaurant_tables
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- customers (tenant-isolated; never public)
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_select_member"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "customers_insert_member"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_member(restaurant_id));

CREATE POLICY "customers_update_member"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

CREATE POLICY "customers_delete_manager_up"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- queues
-- ---------------------------------------------------------------------------
CREATE POLICY "queues_select_member"
  ON public.queues
  FOR SELECT
  TO authenticated
  USING (public.is_branch_member(branch_id));

CREATE POLICY "queues_insert_manager_up"
  ON public.queues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "queues_update_staff_up"
  ON public.queues
  FOR UPDATE
  TO authenticated
  USING (public.is_branch_member(branch_id))
  WITH CHECK (public.is_branch_member(branch_id));

CREATE POLICY "queues_delete_manager_up"
  ON public.queues
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- queue_entries
-- ---------------------------------------------------------------------------
CREATE POLICY "queue_entries_select_member"
  ON public.queue_entries
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(public.restaurant_id_for_queue(queue_id)));

CREATE POLICY "queue_entries_insert_member"
  ON public.queue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_member(public.restaurant_id_for_queue(queue_id)));

CREATE POLICY "queue_entries_update_member"
  ON public.queue_entries
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_member(public.restaurant_id_for_queue(queue_id)))
  WITH CHECK (public.is_restaurant_member(public.restaurant_id_for_queue(queue_id)));

CREATE POLICY "queue_entries_delete_manager_up"
  ON public.queue_entries
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_queue(queue_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- queue_events
-- ---------------------------------------------------------------------------
CREATE POLICY "queue_events_select_member"
  ON public.queue_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_restaurant_member(public.restaurant_id_for_queue_entry(queue_entry_id))
  );

CREATE POLICY "queue_events_insert_member"
  ON public.queue_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_restaurant_member(public.restaurant_id_for_queue_entry(queue_entry_id))
  );

-- Events are append-only for staff; no update/delete policies for authenticated.

-- ---------------------------------------------------------------------------
-- displays
-- ---------------------------------------------------------------------------
CREATE POLICY "displays_select_member"
  ON public.displays
  FOR SELECT
  TO authenticated
  USING (public.is_branch_member(branch_id));

CREATE POLICY "displays_insert_manager_up"
  ON public.displays
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "displays_update_manager_up"
  ON public.displays
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

CREATE POLICY "displays_delete_manager_up"
  ON public.displays
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
CREATE POLICY "reservations_select_member"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (public.is_branch_member(branch_id));

CREATE POLICY "reservations_insert_member"
  ON public.reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_branch_member(branch_id));

CREATE POLICY "reservations_update_member"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (public.is_branch_member(branch_id))
  WITH CHECK (public.is_branch_member(branch_id));

CREATE POLICY "reservations_delete_manager_up"
  ON public.reservations
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(
      public.restaurant_id_for_branch(branch_id),
      ARRAY['OWNER', 'ADMIN', 'MANAGER']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE POLICY "notifications_select_member"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "notifications_insert_member"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_member(restaurant_id));

CREATE POLICY "notifications_update_member"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

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
-- subscriptions (sensitive — owner/admin only)
-- ---------------------------------------------------------------------------
CREATE POLICY "subscriptions_select_owner_admin"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "subscriptions_insert_owner_admin"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "subscriptions_update_owner_admin"
  ON public.subscriptions
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

CREATE POLICY "subscriptions_delete_owner"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (
    public.has_restaurant_role(restaurant_id, ARRAY['OWNER']::public.member_role[])
  );

-- ---------------------------------------------------------------------------
-- audit_logs (members read; inserts by members; no client updates/deletes)
-- ---------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_member"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_member(restaurant_id));

CREATE POLICY "audit_logs_insert_member"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_member(restaurant_id));
