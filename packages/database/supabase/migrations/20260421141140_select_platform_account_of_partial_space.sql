CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."LocalAccess" AS la
      JOIN public."SpaceAccess" AS sa USING (space_id)
      JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
      WHERE la.account_id = p_account_id
      AND sa.permissions >= access_level
    );
$$;

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR public.account_in_shared_space(id, 'partial'));

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";

DROP function public.account_in_shared_space(p_account_id BIGINT);

CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space(account_id));

CREATE OR REPLACE VIEW public.my_accounts AS
SELECT
    id,
    name,
    platform,
    account_local_id,
    write_permission,
    active,
    agent_type,
    metadata,
    dg_account
FROM public."PlatformAccount"
WHERE id IN (
    SELECT "LocalAccess".account_id FROM public."LocalAccess"
        JOIN public."SpaceAccess" USING (space_id)
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
    WHERE permissions >= 'partial'
);

CREATE OR REPLACE FUNCTION public.generic_entity_access(target_id BIGINT, target_type public."EntityType") RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT CASE
        WHEN target_type = 'Space' THEN public.in_space(target_id)
        WHEN target_type = 'Content' THEN public.content_in_space(target_id)
        WHEN target_type = 'Concept' THEN public.concept_in_space(target_id)
        WHEN target_type = 'Document' THEN public.document_in_space(target_id)
        WHEN target_type = 'PlatformAccount' THEN public.account_in_shared_space(target_id)
        ELSE false
    END;
$$;
