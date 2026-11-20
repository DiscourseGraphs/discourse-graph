-- The account policies check access once per query: the helpers take no row column, so (SELECT ...) runs each once.
-- Spaces the caller can read or edit are checked per row against LocalAccess, through its primary key, so single-account checks stay cheap.
-- Inside a policy, LocalAccess is filtered by its own reader-level select policy. PlatformAccount reads start at partial access, so they go through a definer view the planner can inline: one account is checked per row through the primary key, and a full read builds its set once. Writes to LocalAccess and AgentIdentifier go through account_ids_in_shared_spaces.
-- What the policies allow does not change.

-- The planner can't inline this function, and its default estimate of 1000 rows makes it scan SpaceAccess instead of using the primary key.
-- The caller plus their groups is usually a few rows. Measured on generated data: above 10, plans get worse as SpaceAccess grows.
ALTER FUNCTION public.my_user_accounts() ROWS 10;

CREATE OR REPLACE FUNCTION public.my_platform_account_ids() RETURNS SETOF BIGINT
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid();
$$;

COMMENT ON FUNCTION public.my_platform_account_ids IS 'security utility: the platform accounts I own. Takes no row column, so a policy runs it once per query.';

-- LocalAccess and AgentIdentifier write policies; anon cannot write those tables.
REVOKE ALL ON FUNCTION public.my_platform_account_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_platform_account_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_ids_in_shared_spaces(access_level public."SpaceAccessPermissions" = 'reader')
RETURNS TABLE (account_id BIGINT, unowned BOOLEAN)
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT DISTINCT la.account_id, pa.dg_account IS NULL
    FROM public."SpaceAccess" AS sa
    JOIN public.my_user_accounts() AS my (uid) ON (sa.account_uid = my.uid)
    JOIN public."LocalAccess" AS la USING (space_id)
    JOIN public."PlatformAccount" AS pa ON (pa.id = la.account_id)
    WHERE sa.permissions >= access_level;
$$;

COMMENT ON FUNCTION public.account_ids_in_shared_spaces IS 'security utility: the accounts in spaces where I have at least this access level, and whether each is unowned. Takes no row column, so a policy runs it once per query.';

-- LocalAccess and AgentIdentifier write policies; anon cannot write those tables.
REVOKE ALL ON FUNCTION public.account_ids_in_shared_spaces(public."SpaceAccessPermissions") FROM public, anon;
GRANT EXECUTE ON FUNCTION public.account_ids_in_shared_spaces(public."SpaceAccessPermissions") TO authenticated, service_role;

-- Definer view on purpose: inside a policy, LocalAccess is filtered by its own reader-level select policy, so an inline check can't see partial access.
-- Unlike a function, the planner can inline a view, so a policy can check one account without building the whole set.
-- Keep DISTINCT and don't add space_id: LocalAccess only shows memberships at reader level, and one row per membership would reveal them.
-- security_barrier stops a caller's non-leakproof filter from running below the access join, where it would see accounts of other spaces.
CREATE OR REPLACE VIEW public.accounts_in_my_partial_spaces WITH (security_barrier) AS
SELECT DISTINCT la.account_id
FROM public."SpaceAccess" AS sa
    JOIN public.my_user_accounts() AS my (uid) ON (sa.account_uid = my.uid)
    JOIN public."LocalAccess" AS la USING (space_id)
WHERE sa.permissions >= 'partial';

COMMENT ON VIEW public.accounts_in_my_partial_spaces IS 'security utility: the accounts in spaces where I have at least partial access. Used by the PlatformAccount select policy.';

-- anon: public access will read authors through the PlatformAccount select policy, which fails without this grant.
REVOKE ALL ON public.accounts_in_my_partial_spaces FROM public, anon, authenticated, service_role;
GRANT SELECT ON public.accounts_in_my_partial_spaces TO anon, authenticated, service_role;

-- Account policies

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR EXISTS (SELECT 1 FROM public.accounts_in_my_partial_spaces AS v WHERE v.account_id = "PlatformAccount".id));

DROP POLICY IF EXISTS platform_account_delete_policy ON public."PlatformAccount";
CREATE POLICY platform_account_delete_policy ON public."PlatformAccount" FOR DELETE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND EXISTS (SELECT 1 FROM public."LocalAccess" AS la WHERE la.account_id = "PlatformAccount".id AND la.space_id = any((SELECT public.my_space_ids('editor'))::bigint[]))));

DROP POLICY IF EXISTS platform_account_update_policy ON public."PlatformAccount";
CREATE POLICY platform_account_update_policy ON public."PlatformAccount" FOR UPDATE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND EXISTS (SELECT 1 FROM public."LocalAccess" AS la WHERE la.account_id = "PlatformAccount".id AND la.space_id = any((SELECT public.my_space_ids('editor'))::bigint[]))));

DROP POLICY IF EXISTS local_access_delete_policy ON public."LocalAccess";
CREATE POLICY local_access_delete_policy ON public."LocalAccess" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids())));

DROP POLICY IF EXISTS local_access_insert_policy ON public."LocalAccess";
CREATE POLICY local_access_insert_policy ON public."LocalAccess" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids())));

DROP POLICY IF EXISTS local_access_update_policy ON public."LocalAccess";
CREATE POLICY local_access_update_policy ON public."LocalAccess" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids())));

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (EXISTS (SELECT 1 FROM public."LocalAccess" AS la WHERE la.account_id = "AgentIdentifier".account_id AND la.space_id = any((SELECT public.my_space_ids('reader'))::bigint[])));

DROP POLICY IF EXISTS agent_identifier_delete_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_delete_policy ON public."AgentIdentifier" FOR DELETE USING (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids()));

DROP POLICY IF EXISTS agent_identifier_insert_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids()));

DROP POLICY IF EXISTS agent_identifier_update_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE USING (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids()));

CREATE OR REPLACE FUNCTION public.generic_entity_access(target_id BIGINT, target_type public."EntityType") RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT CASE
        WHEN target_type = 'Space' THEN public.in_space(target_id, 'editor')
        WHEN target_type = 'Content' THEN public.content_in_space(target_id, 'editor')
        WHEN target_type = 'Concept' THEN public.concept_in_space(target_id, 'editor')
        WHEN target_type = 'Document' THEN public.document_in_space(target_id, 'editor')
        WHEN target_type = 'PlatformAccount' THEN EXISTS (SELECT 1 FROM public."LocalAccess" AS la WHERE la.account_id = target_id AND la.space_id = any(public.my_space_ids('editor')))
        ELSE false
    END;
$$;

-- No policy or function calls these any more.
DROP FUNCTION IF EXISTS public.account_in_shared_space(BIGINT, public."SpaceAccessPermissions");
DROP FUNCTION IF EXISTS public.unowned_account_in_shared_space(BIGINT, public."SpaceAccessPermissions");
DROP FUNCTION IF EXISTS public.is_my_account(BIGINT);
