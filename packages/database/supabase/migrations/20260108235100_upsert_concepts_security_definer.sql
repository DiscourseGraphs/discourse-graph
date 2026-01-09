-- Make upsert_concepts SECURITY DEFINER to fix RLS issues with ON CONFLICT DO UPDATE.
-- Same issue as upsert_content: direct SELECT works but INSERT ... ON CONFLICT fails
-- due to how PostgreSQL evaluates RLS in plpgsql function context during conflict resolution.

ALTER FUNCTION public.upsert_concepts(bigint, jsonb) SECURITY DEFINER;
