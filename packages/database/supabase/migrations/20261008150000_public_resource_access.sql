INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at, is_super_admin, is_anonymous)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'anon', 'anon', now(), now(), false, true);

CREATE OR REPLACE FUNCTION public.everyone_uid() RETURNS UUID
IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$;

COMMENT ON FUNCTION public.everyone_uid IS 'The uid of the everyone pseudo-user. A grant to it applies to every caller, logged in or not.';

CREATE OR REPLACE FUNCTION public.my_user_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT public.everyone_uid() UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_user_accounts IS 'security utility: The uids which give me access, either as myself or as a group member.';

CREATE OR REPLACE FUNCTION public.my_identity_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_identity_accounts IS 'security utility: The uids I act as, myself or a group I belong to. Excludes the everyone pseudo-user, so a public grant never counts as sharing a space.';

CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."LocalAccess" AS la
      JOIN public."SpaceAccess" AS sa USING (space_id)
      JOIN public.my_identity_accounts() ON (sa.account_uid = my_identity_accounts)
      WHERE la.account_id = p_account_id
      AND sa.permissions >= access_level
    );
$$;

CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public."SpaceAccess" AS sa
        JOIN public.my_identity_accounts() ON (sa.account_uid = my_identity_accounts)
        JOIN public."LocalAccess" AS la USING (space_id)
        JOIN public."PlatformAccount" AS pa ON (pa.id=la.account_id)
        WHERE la.account_id = p_account_id
          AND pa.dg_account IS NULL
          AND sa.permissions >= access_level
    );
$$;

-- The real name only shows to callers who share a space with the account through their own grants.
-- An account visible only through a public grant shows as 'anonymous #<id>'.
CREATE OR REPLACE VIEW public.my_accounts AS
SELECT
    id,
    CASE WHEN id IN (
        SELECT "LocalAccess".account_id FROM public."LocalAccess"
            JOIN public."SpaceAccess" USING (space_id)
            JOIN public.my_identity_accounts() ON (account_uid = my_identity_accounts)
        WHERE permissions >= 'partial'
        UNION
        SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid()
    ) THEN name ELSE ('anonymous #' || id)::varchar END AS name,
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
    SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid()
);

DROP POLICY IF EXISTS resource_access_select_policy ON public."ResourceAccess";
CREATE POLICY resource_access_select_policy ON public."ResourceAccess" FOR SELECT USING (
    account_uid = public.everyone_uid()
    OR public.in_space(space_id)
    OR public.can_access_account(account_uid)
);

GRANT SELECT ON TABLE public."ResourceAccess" TO anon;
GRANT SELECT ON TABLE public."Document" TO anon;
GRANT SELECT ON TABLE public."Content" TO anon;
GRANT SELECT ON TABLE public."Concept" TO anon;
GRANT SELECT ON TABLE public."FileReference" TO anon;

DROP POLICY IF EXISTS "storage_select_assets_access" ON storage.objects;
CREATE POLICY "storage_select_assets_access"
ON storage.objects FOR SELECT TO anon, authenticated USING (
    bucket_id = 'assets' AND file_access(name)
);
