-- Phase 14 prerequisite: commit ARRIVED on reservation_status before it is
-- referenced by indexes/functions in the following migration.
-- PostgreSQL forbids using a newly added enum value in the same transaction.

DO $$
BEGIN
  ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'ARRIVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
