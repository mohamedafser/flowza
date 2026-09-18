-- Flowza Phase 2: multi-tenant restaurant queue foundation
-- Schema only — no auth UI, queue workflows, or billing integrations.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (controlled status / role values)
-- ---------------------------------------------------------------------------
CREATE TYPE public.restaurant_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TYPE public.member_role AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');

CREATE TYPE public.member_status AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

CREATE TYPE public.table_status AS ENUM (
  'AVAILABLE',
  'OCCUPIED',
  'CLEANING',
  'RESERVED',
  'BLOCKED'
);

CREATE TYPE public.queue_status AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

CREATE TYPE public.queue_entry_status AS ENUM (
  'WAITING',
  'CALLED',
  'SEATED',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'NO_SHOW'
);

CREATE TYPE public.queue_event_type AS ENUM (
  'JOINED',
  'CALLED',
  'SKIPPED',
  'CANCELLED',
  'SEATED',
  'COMPLETED',
  'NO_SHOW'
);

CREATE TYPE public.display_mode AS ENUM ('QUEUE', 'TABLES', 'COMBINED');

CREATE TYPE public.reservation_status AS ENUM (
  'PENDING',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);

CREATE TYPE public.notification_channel AS ENUM (
  'EMAIL',
  'SMS',
  'WHATSAPP',
  'IN_APP'
);

CREATE TYPE public.notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TYPE public.subscription_status AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED'
);

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Keep profiles in sync when a new auth user is created (foundation only).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------------
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  email text,
  phone text,
  website text,
  description text,
  timezone text NOT NULL DEFAULT 'UTC',
  currency text NOT NULL DEFAULT 'USD',
  status public.restaurant_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurants_slug_unique UNIQUE (slug),
  CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT restaurants_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER restaurants_set_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Restaurant members (multi-tenant RBAC link)
-- ---------------------------------------------------------------------------
CREATE TABLE public.restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'STAFF',
  status public.member_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_members_restaurant_user_unique UNIQUE (restaurant_id, user_id)
);

CREATE TRIGGER restaurant_members_set_updated_at
BEFORE UPDATE ON public.restaurant_members
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX restaurant_members_restaurant_id_idx
  ON public.restaurant_members (restaurant_id);

CREATE INDEX restaurant_members_user_id_idx
  ON public.restaurant_members (user_id);

CREATE INDEX restaurant_members_active_idx
  ON public.restaurant_members (restaurant_id, user_id)
  WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------------
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  phone text,
  email text,
  timezone text NOT NULL DEFAULT 'UTC',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT branches_restaurant_slug_unique UNIQUE (restaurant_id, slug),
  CONSTRAINT branches_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TRIGGER branches_set_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX branches_restaurant_id_idx ON public.branches (restaurant_id);

-- ---------------------------------------------------------------------------
-- Table sections
-- ---------------------------------------------------------------------------
CREATE TABLE public.table_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT table_sections_branch_name_unique UNIQUE (branch_id, name)
);

CREATE TRIGGER table_sections_set_updated_at
BEFORE UPDATE ON public.table_sections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX table_sections_branch_id_idx ON public.table_sections (branch_id);

-- ---------------------------------------------------------------------------
-- Restaurant tables (avoid reserved word "tables")
-- ---------------------------------------------------------------------------
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.table_sections (id) ON DELETE SET NULL,
  table_number text NOT NULL,
  name text,
  capacity integer NOT NULL DEFAULT 2,
  status public.table_status NOT NULL DEFAULT 'AVAILABLE',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_tables_capacity_positive CHECK (capacity > 0),
  CONSTRAINT restaurant_tables_branch_number_unique UNIQUE (branch_id, table_number)
);

CREATE TRIGGER restaurant_tables_set_updated_at
BEFORE UPDATE ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX restaurant_tables_branch_id_idx ON public.restaurant_tables (branch_id);
CREATE INDEX restaurant_tables_section_id_idx ON public.restaurant_tables (section_id);
CREATE INDEX restaurant_tables_status_idx ON public.restaurant_tables (branch_id, status);

-- ---------------------------------------------------------------------------
-- Customers (tenant-scoped; no auth account required)
-- ---------------------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX customers_restaurant_id_idx ON public.customers (restaurant_id);
CREATE INDEX customers_phone_idx ON public.customers (restaurant_id, phone);
CREATE INDEX customers_email_idx ON public.customers (restaurant_id, email);

-- ---------------------------------------------------------------------------
-- Queues
-- ---------------------------------------------------------------------------
CREATE TABLE public.queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.queue_status NOT NULL DEFAULT 'ACTIVE',
  prefix text NOT NULL DEFAULT 'A',
  current_number integer NOT NULL DEFAULT 0,
  estimated_service_minutes integer,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT queues_current_number_non_negative CHECK (current_number >= 0),
  CONSTRAINT queues_estimated_service_positive CHECK (
    estimated_service_minutes IS NULL OR estimated_service_minutes > 0
  ),
  CONSTRAINT queues_branch_name_unique UNIQUE (branch_id, name)
);

CREATE TRIGGER queues_set_updated_at
BEFORE UPDATE ON public.queues
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX queues_branch_id_idx ON public.queues (branch_id);
CREATE INDEX queues_status_idx ON public.queues (branch_id, status);

-- ---------------------------------------------------------------------------
-- Queue entries
-- Token uniqueness is scoped to queue + business date (not global).
-- ---------------------------------------------------------------------------
CREATE TABLE public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.queues (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  token text NOT NULL,
  business_date date NOT NULL DEFAULT ((timezone('utc', now()))::date),
  party_size integer NOT NULL DEFAULT 1,
  status public.queue_entry_status NOT NULL DEFAULT 'WAITING',
  joined_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  called_at timestamptz,
  seated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT queue_entries_party_size_positive CHECK (party_size > 0),
  CONSTRAINT queue_entries_token_per_queue_day_unique UNIQUE (queue_id, business_date, token)
);

CREATE TRIGGER queue_entries_set_updated_at
BEFORE UPDATE ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX queue_entries_queue_id_idx ON public.queue_entries (queue_id);
CREATE INDEX queue_entries_status_idx ON public.queue_entries (queue_id, status);
CREATE INDEX queue_entries_created_at_idx ON public.queue_entries (created_at);
CREATE INDEX queue_entries_active_lookup_idx
  ON public.queue_entries (queue_id, status, created_at)
  WHERE status IN ('WAITING', 'CALLED', 'SEATED');
CREATE INDEX queue_entries_customer_id_idx ON public.queue_entries (customer_id);

-- ---------------------------------------------------------------------------
-- Queue events (append-only history)
-- ---------------------------------------------------------------------------
CREATE TABLE public.queue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id uuid NOT NULL REFERENCES public.queue_entries (id) ON DELETE CASCADE,
  event_type public.queue_event_type NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT queue_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX queue_events_queue_entry_id_idx ON public.queue_events (queue_entry_id);
CREATE INDEX queue_events_created_at_idx ON public.queue_events (created_at);

-- ---------------------------------------------------------------------------
-- Displays
-- ---------------------------------------------------------------------------
CREATE TABLE public.displays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  name text NOT NULL,
  display_code text NOT NULL,
  mode public.display_mode NOT NULL DEFAULT 'QUEUE',
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT displays_display_code_unique UNIQUE (display_code),
  CONSTRAINT displays_display_code_format CHECK (display_code ~ '^[A-Z0-9]{4,12}$')
);

CREATE TRIGGER displays_set_updated_at
BEFORE UPDATE ON public.displays
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX displays_branch_id_idx ON public.displays (branch_id);
CREATE INDEX displays_is_active_idx ON public.displays (branch_id, is_active);

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  reservation_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  party_size integer NOT NULL DEFAULT 2,
  status public.reservation_status NOT NULL DEFAULT 'PENDING',
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT reservations_party_size_positive CHECK (party_size > 0),
  CONSTRAINT reservations_end_after_start CHECK (
    end_time IS NULL OR end_time > start_time
  )
);

CREATE TRIGGER reservations_set_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX reservations_branch_id_idx ON public.reservations (branch_id);
CREATE INDEX reservations_reservation_date_idx
  ON public.reservations (branch_id, reservation_date);
CREATE INDEX reservations_status_idx ON public.reservations (branch_id, status);
CREATE INDEX reservations_customer_id_idx ON public.reservations (customer_id);

-- ---------------------------------------------------------------------------
-- Notifications (provider integrations come later)
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  queue_entry_id uuid REFERENCES public.queue_entries (id) ON DELETE SET NULL,
  channel public.notification_channel NOT NULL,
  type text NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'PENDING',
  recipient text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT notifications_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX notifications_restaurant_id_idx ON public.notifications (restaurant_id);
CREATE INDEX notifications_status_idx ON public.notifications (restaurant_id, status);
CREATE INDEX notifications_customer_id_idx ON public.notifications (customer_id);
CREATE INDEX notifications_queue_entry_id_idx ON public.notifications (queue_entry_id);

-- ---------------------------------------------------------------------------
-- Subscriptions (billing providers come later)
-- ---------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  plan text NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'TRIALING',
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT subscriptions_period_order CHECK (
    current_period_start IS NULL
    OR current_period_end IS NULL
    OR current_period_end >= current_period_start
  )
);

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX subscriptions_provider_id_unique
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE INDEX subscriptions_restaurant_id_idx ON public.subscriptions (restaurant_id);
CREATE INDEX subscriptions_status_idx ON public.subscriptions (restaurant_id, status);

-- ---------------------------------------------------------------------------
-- Audit logs (append-oriented)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_logs_restaurant_id_idx ON public.audit_logs (restaurant_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (restaurant_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Tenant-scoped integrity: section/table must share the same branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_table_section_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  section_branch_id uuid;
BEGIN
  IF NEW.section_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT branch_id INTO section_branch_id
  FROM public.table_sections
  WHERE id = NEW.section_id;

  IF section_branch_id IS NULL THEN
    RAISE EXCEPTION 'table section % not found', NEW.section_id;
  END IF;

  IF section_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'table section must belong to the same branch as the table';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_tables_enforce_section_branch
BEFORE INSERT OR UPDATE OF branch_id, section_id ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_table_section_branch();

-- Customer on reservation/queue_entry must belong to the same restaurant as the branch/queue
CREATE OR REPLACE FUNCTION public.enforce_customer_restaurant_for_queue_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  entry_restaurant_id uuid;
  customer_restaurant_id uuid;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.restaurant_id INTO entry_restaurant_id
  FROM public.queues q
  JOIN public.branches b ON b.id = q.branch_id
  WHERE q.id = NEW.queue_id;

  SELECT c.restaurant_id INTO customer_restaurant_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF entry_restaurant_id IS NULL OR customer_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'queue entry or customer not found for tenant check';
  END IF;

  IF entry_restaurant_id <> customer_restaurant_id THEN
    RAISE EXCEPTION 'customer must belong to the same restaurant as the queue';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_entries_enforce_customer_restaurant
BEFORE INSERT OR UPDATE OF queue_id, customer_id ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_customer_restaurant_for_queue_entry();

CREATE OR REPLACE FUNCTION public.enforce_customer_restaurant_for_reservation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reservation_restaurant_id uuid;
  customer_restaurant_id uuid;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.restaurant_id INTO reservation_restaurant_id
  FROM public.branches b
  WHERE b.id = NEW.branch_id;

  SELECT c.restaurant_id INTO customer_restaurant_id
  FROM public.customers c
  WHERE c.id = NEW.customer_id;

  IF reservation_restaurant_id IS NULL OR customer_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'reservation or customer not found for tenant check';
  END IF;

  IF reservation_restaurant_id <> customer_restaurant_id THEN
    RAISE EXCEPTION 'customer must belong to the same restaurant as the branch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_enforce_customer_restaurant
BEFORE INSERT OR UPDATE OF branch_id, customer_id ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_customer_restaurant_for_reservation();
