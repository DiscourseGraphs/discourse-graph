CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public."SpaceAccess" AS sa
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        JOIN public."LocalAccess" AS la USING (space_id)
        JOIN public."PlatformAccount" AS pa ON (pa.id=la.account_id)
        WHERE la.account_id = p_account_id
          AND pa.dg_account IS NULL
          AND sa.permissions >= access_level
    );
$$;


DROP POLICY IF EXISTS platform_account_delete_policy ON public."PlatformAccount";
CREATE POLICY platform_account_delete_policy ON public."PlatformAccount" FOR DELETE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id, 'editor')));

DROP POLICY IF EXISTS platform_account_insert_policy ON public."PlatformAccount";
CREATE POLICY platform_account_insert_policy ON public."PlatformAccount" FOR INSERT WITH CHECK (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id, 'editor')));

DROP POLICY IF EXISTS platform_account_update_policy ON public."PlatformAccount";
CREATE POLICY platform_account_update_policy ON public."PlatformAccount" FOR UPDATE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id, 'editor')));

DROP POLICY IF EXISTS local_access_delete_policy ON public."LocalAccess";
CREATE POLICY local_access_delete_policy ON public."LocalAccess" FOR DELETE USING (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id));

DROP POLICY IF EXISTS local_access_insert_policy ON public."LocalAccess";
CREATE POLICY local_access_insert_policy ON public."LocalAccess" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id));

DROP POLICY IF EXISTS local_access_update_policy ON public."LocalAccess";
CREATE POLICY local_access_update_policy ON public."LocalAccess" FOR UPDATE USING (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_delete_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_delete_policy ON public."AgentIdentifier" FOR DELETE USING (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_insert_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_update_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE USING (public.unowned_account_in_shared_space(account_id, 'editor') OR public.is_my_account(account_id));

DROP FUNCTION public.unowned_account_in_shared_space(BIGINT);

CREATE OR REPLACE FUNCTION public.document_in_space(document_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id, access_level) FROM public."Document" WHERE id=document_id
$$;

CREATE OR REPLACE FUNCTION public.can_view_concept(concept_id BIGINT) RETURNS BOOLEAN
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.can_view_specific_resource(space_id, source_local_id) FROM public."Concept" WHERE id=concept_id;
$$;

CREATE OR REPLACE FUNCTION public.generic_entity_access(target_id BIGINT, target_type public."EntityType") RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT CASE
        WHEN target_type = 'Space' THEN public.in_space(target_id, 'editor')
        WHEN target_type = 'Content' THEN public.content_in_space(target_id, 'editor')
        WHEN target_type = 'Concept' THEN public.concept_in_space(target_id, 'editor')
        WHEN target_type = 'Document' THEN public.document_in_space(target_id, 'editor')
        WHEN target_type = 'PlatformAccount' THEN public.account_in_shared_space(target_id, 'editor')
        ELSE false
    END;
$$;

DROP FUNCTION public.document_in_space(BIGINT);

DROP POLICY IF EXISTS embedding_openai_te3s_1536_delete_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" ;
CREATE POLICY embedding_openai_te3s_1536_delete_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR DELETE USING (public.content_in_space (target_id, 'editor')) ;
DROP POLICY IF EXISTS embedding_openai_te3s_1536_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" ;
CREATE POLICY embedding_openai_te3s_1536_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR INSERT WITH CHECK (public.content_in_space (target_id, 'editor')) ;
DROP POLICY IF EXISTS embedding_openai_te3s_1536_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" ;
CREATE POLICY embedding_openai_te3s_1536_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR UPDATE USING (public.content_in_space (target_id, 'editor')) ;

DROP POLICY IF EXISTS document_delete_policy ON public."Document";
CREATE POLICY document_delete_policy ON public."Document" FOR DELETE USING (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS document_insert_policy ON public."Document";
CREATE POLICY document_insert_policy ON public."Document" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS document_update_policy ON public."Document";
CREATE POLICY document_update_policy ON public."Document" FOR UPDATE USING (public.in_space(space_id, 'editor'));

DROP POLICY IF EXISTS content_delete_policy ON public."Content";
CREATE POLICY content_delete_policy ON public."Content" FOR DELETE USING (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS content_insert_policy ON public."Content";
CREATE POLICY content_insert_policy ON public."Content" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS content_update_policy ON public."Content";
CREATE POLICY content_update_policy ON public."Content" FOR UPDATE USING (public.in_space(space_id, 'editor'));

DROP POLICY IF EXISTS concept_delete_policy ON public."Concept";
CREATE POLICY concept_delete_policy ON public."Concept" FOR DELETE USING (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS concept_insert_policy ON public."Concept";
CREATE POLICY concept_insert_policy ON public."Concept" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS concept_update_policy ON public."Concept";
CREATE POLICY concept_update_policy ON public."Concept" FOR UPDATE USING (public.in_space(space_id, 'editor'));

DROP POLICY IF EXISTS file_reference_delete_policy ON public."FileReference";
CREATE POLICY file_reference_delete_policy ON public."FileReference" FOR DELETE USING (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS file_reference_insert_policy ON public."FileReference";
CREATE POLICY file_reference_insert_policy ON public."FileReference" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS file_reference_update_policy ON public."FileReference";
CREATE POLICY file_reference_update_policy ON public."FileReference" FOR UPDATE USING (public.in_space(space_id, 'editor'));

DROP POLICY IF EXISTS concept_contributors_policy ON public.concept_contributors;
DROP POLICY IF EXISTS concept_contributors_select_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_select_policy ON public.concept_contributors FOR SELECT USING (public.concept_in_space(concept_id) OR public.can_view_concept(concept_id));
DROP POLICY IF EXISTS concept_contributors_delete_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_delete_policy ON public.concept_contributors FOR DELETE USING (public.concept_in_space(concept_id, 'editor'));
DROP POLICY IF EXISTS concept_contributors_insert_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_insert_policy ON public.concept_contributors FOR INSERT WITH CHECK (public.concept_in_space(concept_id, 'editor'));
DROP POLICY IF EXISTS concept_contributors_update_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_update_policy ON public.concept_contributors FOR UPDATE USING (public.concept_in_space(concept_id, 'editor'));

DROP POLICY IF EXISTS content_contributors_policy ON public.content_contributors;
DROP POLICY IF EXISTS content_contributors_select_policy ON public.content_contributors;
CREATE POLICY content_contributors_select_policy ON public.content_contributors FOR SELECT USING (public.content_in_space(content_id) OR public.can_view_content(content_id));
DROP POLICY IF EXISTS content_contributors_delete_policy ON public.content_contributors;
CREATE POLICY content_contributors_delete_policy ON public.content_contributors FOR DELETE USING (public.content_in_space(content_id, 'editor'));
DROP POLICY IF EXISTS content_contributors_insert_policy ON public.content_contributors;
CREATE POLICY content_contributors_insert_policy ON public.content_contributors FOR INSERT WITH CHECK (public.content_in_space(content_id, 'editor'));
DROP POLICY IF EXISTS content_contributors_update_policy ON public.content_contributors;
CREATE POLICY content_contributors_update_policy ON public.content_contributors FOR UPDATE USING (public.content_in_space(content_id, 'editor'));
