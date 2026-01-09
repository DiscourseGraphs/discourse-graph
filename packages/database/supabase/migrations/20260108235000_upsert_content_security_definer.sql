-- Make upsert_content SECURITY DEFINER to fix RLS issues with ON CONFLICT DO UPDATE.
-- Direct SELECT from Content works, but INSERT ... ON CONFLICT fails due to how
-- PostgreSQL evaluates RLS in plpgsql function context during conflict resolution.
-- This is the standard pattern for "service functions" that operate on RLS-protected tables.

ALTER FUNCTION public.upsert_content(bigint, jsonb, bigint, boolean) SECURITY DEFINER;
