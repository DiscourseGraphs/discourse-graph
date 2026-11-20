CREATE OR REPLACE VIEW public.my_accounts AS
SELECT
    id,
    name,
    platform,
    account_local_id,
    write_permission,
    active,
    agent_type
FROM public."PlatformAccount"
WHERE id IN (
    SELECT "LocalAccess".account_id FROM public."LocalAccess"
        JOIN public."SpaceAccess" USING (space_id)
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
    WHERE permissions >= 'partial'
    UNION
    SELECT pa.id FROM public."PlatformAccount" AS pa WHERE pa.dg_account = auth.uid()
);
