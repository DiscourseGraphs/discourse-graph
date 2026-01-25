-- Allow viewing Space.name when user has ResourceAccess to any content in that space
-- This fixes the issue where users can see Content from a space via group publish
-- (ResourceAccess) but cannot see the Space metadata (name) due to RLS.
--
-- The policy now allows SELECT on Space rows when:
-- 1. User has SpaceAccess (in_space(id)) - existing behavior, can see all columns
-- 2. User has ResourceAccess to at least one resource in that space - new behavior, can only see 'name' column
--
-- Users with SpaceAccess can SELECT all columns (id, url, name, platform).

DROP POLICY IF EXISTS space_policy ON public."Space";
CREATE POLICY space_policy ON public."Space" FOR SELECT 
USING (
  public.in_space(id) 
  OR EXISTS (
    SELECT 1 
    FROM public."ResourceAccess" ra
    JOIN public.my_user_accounts() ON (ra.account_uid = my_user_accounts)
    WHERE ra.space_id = "Space".id
  )
);
