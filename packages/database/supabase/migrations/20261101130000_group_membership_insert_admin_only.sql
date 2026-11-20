-- NOT group_exists(group_id) let anyone join any user id that was not yet a group, including another user's, and so gain that user's space access.
DROP POLICY IF EXISTS group_membership_insert_policy ON public.group_membership;
CREATE POLICY group_membership_insert_policy ON public.group_membership FOR INSERT WITH CHECK (public.is_group_admin(group_id));
COMMENT ON POLICY group_membership_insert_policy ON public.group_membership IS 'Only group admins add members. The create-group edge function adds the first admin with the service role, and accept_group_invitation adds invited members as a security definer.';
-- Unused once the policy no longer calls it.
DROP FUNCTION IF EXISTS public.group_exists(UUID);
