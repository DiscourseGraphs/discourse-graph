-- Policies check access once per query, not once per row: (SELECT ...) runs each user-level lookup once,
-- in the same form as the my_* views.
-- A row shared through ResourceAccess also needs partial access to its space, as in the views.

-- Select policies on the shared resources

DROP POLICY IF EXISTS concept_select_policy ON public."Concept";
CREATE POLICY concept_select_policy ON public."Concept" FOR SELECT USING (
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    )
);

DROP POLICY IF EXISTS document_select_policy ON public."Document";
CREATE POLICY document_select_policy ON public."Document" FOR SELECT USING (
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    )
);

DROP POLICY IF EXISTS content_select_policy ON public."Content";
CREATE POLICY content_select_policy ON public."Content" FOR SELECT USING (
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    )
);

DROP POLICY IF EXISTS file_reference_select_policy ON public."FileReference";
CREATE POLICY file_reference_select_policy ON public."FileReference" FOR SELECT USING (
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    )
);

DROP POLICY IF EXISTS resource_access_select_policy ON public."ResourceAccess";
CREATE POLICY resource_access_select_policy ON public."ResourceAccess" FOR SELECT USING (
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR account_uid IN (SELECT public.my_user_accounts())
);

DROP POLICY IF EXISTS concept_contributors_select_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_select_policy ON public.concept_contributors FOR SELECT USING (
    EXISTS (SELECT 1 FROM public."Concept" AS c WHERE c.id = concept_contributors.concept_id)
);
COMMENT ON POLICY concept_contributors_select_policy ON public.concept_contributors
IS 'Visible exactly when the concept is visible under its own select policy.';

DROP POLICY IF EXISTS content_contributors_select_policy ON public.content_contributors;
CREATE POLICY content_contributors_select_policy ON public.content_contributors FOR SELECT USING (
    EXISTS (SELECT 1 FROM public."Content" AS ct WHERE ct.id = content_contributors.content_id)
);
COMMENT ON POLICY content_contributors_select_policy ON public.content_contributors
IS 'Visible exactly when the content is visible under its own select policy.';

DROP POLICY IF EXISTS embedding_openai_te3s_1536_select_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_select_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public."Content" AS ct
        WHERE ct.id = "ContentEmbedding_openai_text_embedding_3_small_1536".target_id
    )
);
COMMENT ON POLICY embedding_openai_te3s_1536_select_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
IS 'Visible exactly when the content is visible under its own select policy.';

CREATE OR REPLACE FUNCTION public.file_access(hashvalue VARCHAR) RETURNS boolean
SET search_path = ''
SECURITY DEFINER
LANGUAGE sql AS $$
SELECT EXISTS (
    SELECT true FROM public."FileReference"
    WHERE filehash = hashvalue AND (
        public.in_space(space_id)
        OR (public.in_space(space_id, 'partial') AND public.can_view_specific_resource(space_id, source_local_id))
    )
    LIMIT 1);
$$;


-- Write policies on the shared resources. The ResourceAccess delete policy keeps letting the grantee remove a grant made to them.

DROP POLICY IF EXISTS concept_delete_policy ON public."Concept";
CREATE POLICY concept_delete_policy ON public."Concept" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS concept_insert_policy ON public."Concept";
CREATE POLICY concept_insert_policy ON public."Concept" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS concept_update_policy ON public."Concept";
CREATE POLICY concept_update_policy ON public."Concept" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS document_delete_policy ON public."Document";
CREATE POLICY document_delete_policy ON public."Document" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS document_insert_policy ON public."Document";
CREATE POLICY document_insert_policy ON public."Document" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS document_update_policy ON public."Document";
CREATE POLICY document_update_policy ON public."Document" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS content_delete_policy ON public."Content";
CREATE POLICY content_delete_policy ON public."Content" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS content_insert_policy ON public."Content";
CREATE POLICY content_insert_policy ON public."Content" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS content_update_policy ON public."Content";
CREATE POLICY content_update_policy ON public."Content" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS file_reference_delete_policy ON public."FileReference";
CREATE POLICY file_reference_delete_policy ON public."FileReference" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS file_reference_insert_policy ON public."FileReference";
CREATE POLICY file_reference_insert_policy ON public."FileReference" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS file_reference_update_policy ON public."FileReference";
CREATE POLICY file_reference_update_policy ON public."FileReference" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS resource_access_delete_policy ON public."ResourceAccess";
CREATE POLICY resource_access_delete_policy ON public."ResourceAccess" FOR DELETE USING (
    space_id = any((SELECT public.my_space_ids('editor'))::bigint [])
    OR account_uid IN (SELECT public.my_user_accounts())
);

DROP POLICY IF EXISTS resource_access_insert_policy ON public."ResourceAccess";
CREATE POLICY resource_access_insert_policy ON public."ResourceAccess" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS resource_access_update_policy ON public."ResourceAccess";
CREATE POLICY resource_access_update_policy ON public."ResourceAccess" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS embedding_openai_te3s_1536_delete_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_delete_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public."Content" AS ct
        WHERE
            ct.id = "ContentEmbedding_openai_text_embedding_3_small_1536".target_id
            AND ct.space_id = any((SELECT public.my_space_ids('editor'))::bigint [])
    )
);

DROP POLICY IF EXISTS embedding_openai_te3s_1536_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public."Content" AS ct
        WHERE
            ct.id = "ContentEmbedding_openai_text_embedding_3_small_1536".target_id
            AND ct.space_id = any((SELECT public.my_space_ids('editor'))::bigint [])
    )
);

DROP POLICY IF EXISTS embedding_openai_te3s_1536_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public."Content" AS ct
        WHERE
            ct.id = "ContentEmbedding_openai_text_embedding_3_small_1536".target_id
            AND ct.space_id = any((SELECT public.my_space_ids('editor'))::bigint [])
    )
);


-- Space, SpaceAccess, and the LocalAccess select policy

DROP POLICY IF EXISTS space_select_policy ON public."Space";
CREATE POLICY space_select_policy ON public."Space" FOR SELECT USING (id = any((SELECT public.my_space_ids('partial'))::bigint []));

DROP POLICY IF EXISTS space_delete_policy ON public."Space";
CREATE POLICY space_delete_policy ON public."Space" FOR DELETE USING (id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS space_update_policy ON public."Space";
CREATE POLICY space_update_policy ON public."Space" FOR UPDATE USING (id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (space_id = any((SELECT public.my_space_ids('reader'))::bigint []));

DROP POLICY IF EXISTS space_access_delete_policy ON public."SpaceAccess";
CREATE POLICY space_access_delete_policy ON public."SpaceAccess" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS space_access_insert_policy ON public."SpaceAccess";
CREATE POLICY space_access_insert_policy ON public."SpaceAccess" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS space_access_update_policy ON public."SpaceAccess";
CREATE POLICY space_access_update_policy ON public."SpaceAccess" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS local_access_select_policy ON public."LocalAccess";
CREATE POLICY local_access_select_policy ON public."LocalAccess" FOR SELECT USING (space_id = any((SELECT public.my_space_ids('reader'))::bigint []));


-- No policy calls it any more.
DROP FUNCTION IF EXISTS public.can_access_account(UUID);
