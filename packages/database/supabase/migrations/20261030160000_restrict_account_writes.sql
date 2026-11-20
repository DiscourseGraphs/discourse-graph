-- Clients cannot set who owns an account (dg_account) or change what identifies it (agent_type, platform, account_local_id).
-- Clients create and upsert accounts through upsert_account_in_space, which also adds the account to the space.
-- Updates are granted per column: a new column is not client-writable until it is added to this grant.
REVOKE INSERT, UPDATE ON TABLE public."PlatformAccount" FROM authenticated;
GRANT UPDATE (name, active, metadata) ON TABLE public."PlatformAccount" TO authenticated;

-- No client can insert any more, so this policy has nothing left to decide.
DROP POLICY IF EXISTS platform_account_insert_policy ON public."PlatformAccount";

DROP POLICY IF EXISTS local_access_delete_policy ON public."LocalAccess";
CREATE POLICY local_access_delete_policy ON public."LocalAccess" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id)));

DROP POLICY IF EXISTS local_access_insert_policy ON public."LocalAccess";
CREATE POLICY local_access_insert_policy ON public."LocalAccess" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id)));

DROP POLICY IF EXISTS local_access_update_policy ON public."LocalAccess";
CREATE POLICY local_access_update_policy ON public."LocalAccess" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id)));
