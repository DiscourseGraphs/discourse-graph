CREATE OR REPLACE FUNCTION public.everyone_uid() RETURNS UUID
IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$;

COMMENT ON FUNCTION public.everyone_uid IS 'The uid of the everyone pseudo-user. A grant to it applies to every caller, logged in or not.';

-- Revoked explicitly: the declarative sync may create this function before the default privileges apply.
REVOKE EXECUTE ON FUNCTION public.everyone_uid FROM public;
-- The ResourceAccess select policy calls it as the caller.
GRANT EXECUTE ON FUNCTION public.everyone_uid TO anon;

INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at, is_super_admin, is_anonymous)
VALUES (public.everyone_uid(), public.everyone_uid(), 'anon', 'anon', now(), now(), false, true)
ON CONFLICT (id) DO NOTHING;

-- Every caller, anon included, gets the everyone pseudo-user's permissions, so it must never edit.
ALTER TABLE public."SpaceAccess" ADD CONSTRAINT "SpaceAccess_everyone_read_only" CHECK (
    account_uid <> public.everyone_uid() OR permissions <= 'reader'
);

CREATE OR REPLACE FUNCTION public.my_user_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
ROWS 10
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT public.everyone_uid() UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_user_accounts IS 'security utility: The uids which give me access: myself, my groups, and the everyone pseudo-user.';

CREATE OR REPLACE FUNCTION public.my_identity_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
ROWS 10
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_identity_accounts IS 'security utility: The uids I act as, myself or a group I belong to. Excludes the everyone pseudo-user, so a public grant never counts as sharing a space.';
-- Public access: the my_accounts view and the account helpers.
GRANT EXECUTE ON FUNCTION public.my_identity_accounts TO anon;

CREATE OR REPLACE FUNCTION public.account_ids_in_shared_spaces(access_level public."SpaceAccessPermissions" = 'reader')
RETURNS TABLE (account_id BIGINT, unowned BOOLEAN)
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT DISTINCT la.account_id, pa.dg_account IS NULL
    FROM public."SpaceAccess" AS sa
    JOIN public.my_identity_accounts() AS my (uid) ON (sa.account_uid = my.uid)
    JOIN public."LocalAccess" AS la USING (space_id)
    JOIN public."PlatformAccount" AS pa ON (pa.id = la.account_id)
    WHERE sa.permissions >= access_level;
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
        SELECT pa.id FROM public."PlatformAccount" AS pa WHERE pa.dg_account = auth.uid()
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
    SELECT pa.id FROM public."PlatformAccount" AS pa WHERE pa.dg_account = auth.uid()
);

-- Uses my_identity_accounts: a public grant must not expose the real name and dg_account of a space's accounts.
-- Public authors reach callers through my_accounts instead, under an anonymous name.
CREATE OR REPLACE VIEW public.accounts_in_my_partial_spaces WITH (security_barrier) AS
SELECT DISTINCT la.account_id
FROM public."SpaceAccess" AS sa
    JOIN public.my_identity_accounts() AS my (uid) ON (sa.account_uid = my.uid)
    JOIN public."LocalAccess" AS la USING (space_id)
WHERE sa.permissions >= 'partial';

DROP POLICY IF EXISTS resource_access_select_policy ON public."ResourceAccess";
-- A space published at reader level shows all its grants, to visitors too; such a space needs no other grant.
CREATE POLICY resource_access_select_policy ON public."ResourceAccess" FOR SELECT USING (
    account_uid = public.everyone_uid()
    OR space_id = any((SELECT public.my_space_ids('reader'))::bigint[])
    OR account_uid IN (SELECT public.my_user_accounts())
);

-- Identifiers hold emails, so they show only through the caller's own grants: a public grant does not count.
DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('reader')));

-- my_identity_accounts: a grant to the everyone pseudo-user is not the caller's own, so only an editor can delete it.
DROP POLICY IF EXISTS resource_access_delete_policy ON public."ResourceAccess";
CREATE POLICY resource_access_delete_policy ON public."ResourceAccess" FOR DELETE USING (
    space_id = any((SELECT public.my_space_ids('editor'))::bigint[])
    OR account_uid IN (SELECT public.my_identity_accounts())
);

-- Public access: the select policies decide which rows anon sees.
-- ResourceAccess is also read as the caller by my_accessible_resources() and my_resource_grants, for the my_* views.
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
