CREATE TYPE public."SpaceAccessPermissions" AS ENUM (
    'partial',
    'reader',
    'editor'
);

ALTER TABLE public."SpaceAccess" ADD COLUMN permissions public."SpaceAccessPermissions";

UPDATE public."SpaceAccess" SET permissions = (CASE WHEN editor THEN 'editor' ELSE 'reader' END)::public."SpaceAccessPermissions";

ALTER TABLE public."SpaceAccess" ALTER COLUMN permissions SET NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_account_in_space(
    space_id_ BIGINT,
    local_account public.account_local_input
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    platform_ public."Platform";
    account_id_ BIGINT;
    user_uid UUID;
BEGIN
    SELECT platform INTO STRICT platform_ FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            local_account.account_local_id, local_account.name, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), pa.name)
        RETURNING id, dg_account INTO STRICT account_id_, user_uid;
    IF user_uid IS NOT NULL THEN
        INSERT INTO public."SpaceAccess" as sa (space_id, account_uid, permissions)
            VALUES (space_id_, user_uid,
                CASE WHEN COALESCE(local_account.space_editor, true) THEN 'editor'
                ELSE 'reader' END)
            ON CONFLICT (space_id, account_uid)
            DO UPDATE SET editor = CASE
                WHEN COALESCE(local_account.space_editor, sa.editor, true) THEN 'editor'
                ELSE 'reader' END;
    END IF;
    INSERT INTO public."LocalAccess" (space_id, account_id) values (space_id_, account_id_)
        ON CONFLICT (space_id, account_id)
        DO NOTHING;
    IF local_account.email IS NOT NULL THEN
        -- TODO: how to distinguish basic untrusted from platform placeholder email?
        INSERT INTO public."AgentIdentifier" as ai (account_id, value, identifier_type, trusted) VALUES (account_id_, local_account.email, 'email', COALESCE(local_account.email_trusted, false))
        ON CONFLICT (value, identifier_type, account_id)
        DO UPDATE SET trusted = COALESCE(local_account.email_trusted, ai.trusted, false);
    END IF;
    RETURN account_id_;
END;
$$;


CREATE OR REPLACE FUNCTION public.my_space_ids(access_level public."SpaceAccessPermissions" = 'reader') RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COALESCE(array_agg(distinct space_id), '{}') AS ids
        FROM public."SpaceAccess"
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
        WHERE permissions >= access_level;
$$;

CREATE OR REPLACE FUNCTION public.my_space_ids() RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.my_space_ids('reader');
$$;

CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT 1 FROM public."SpaceAccess" AS sa
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        WHERE sa.space_id = in_space.space_id AND sa.permissions >= access_level);
$$;

CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id, 'reader');
$$;

DROP FUNCTION public.my_editable_space_ids();


CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."LocalAccess" AS la
      JOIN public."SpaceAccess" AS sa USING (space_id)
      JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
      WHERE la.account_id = p_account_id
      AND sa.permissions >= 'reader'
    );
$$;


CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT) RETURNS boolean
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
          AND sa.permissions >= 'reader'
    );
$$;

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
    WHERE permissions >= 'reader'
);

CREATE OR REPLACE FUNCTION public.concept_in_space(concept_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id, access_level) FROM public."Concept" WHERE id=concept_id
$$;

CREATE OR REPLACE FUNCTION public.content_in_space(content_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id, access_level) FROM public."Content" WHERE id=content_id
$$;

DROP FUNCTION IF EXISTS public.concept_in_editable_space(bigint);
DROP FUNCTION IF EXISTS public.content_in_editable_space(bigint);

DROP POLICY IF EXISTS resource_access_delete_policy ON public."ResourceAccess";
DROP POLICY IF EXISTS resource_access_insert_policy ON public."ResourceAccess";
DROP POLICY IF EXISTS resource_access_update_policy ON public."ResourceAccess";
DROP POLICY IF EXISTS space_policy ON public."Space";
DROP POLICY IF EXISTS space_select_policy ON public."Space";
DROP POLICY IF EXISTS space_delete_policy ON public."Space";
DROP POLICY IF EXISTS space_update_policy ON public."Space";
DROP POLICY IF EXISTS space_insert_policy ON public."Space";
DROP POLICY IF EXISTS concept_delete_policy ON public."Concept";
DROP POLICY IF EXISTS concept_insert_policy ON public."Concept";
DROP POLICY IF EXISTS concept_select_policy ON public."Concept";
DROP POLICY IF EXISTS concept_update_policy ON public."Concept";
DROP POLICY IF EXISTS content_delete_policy ON public."Content";
DROP POLICY IF EXISTS content_insert_policy ON public."Content";
DROP POLICY IF EXISTS content_select_policy ON public."Content";
DROP POLICY IF EXISTS content_update_policy ON public."Content";
DROP POLICY IF EXISTS embedding_openai_te3s_1536_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
DROP POLICY IF EXISTS document_delete_policy ON public."Document";
DROP POLICY IF EXISTS document_insert_policy ON public."Document";
DROP POLICY IF EXISTS document_select_policy ON public."Document";
DROP POLICY IF EXISTS document_update_policy ON public."Document";
DROP POLICY IF EXISTS file_reference_delete_policy ON public."FileReference";
DROP POLICY IF EXISTS file_reference_insert_policy ON public."FileReference";
DROP POLICY IF EXISTS file_reference_select_policy ON public."FileReference";
DROP POLICY IF EXISTS file_reference_update_policy ON public."FileReference";
DROP POLICY IF EXISTS local_access_select_policy ON public."LocalAccess";
DROP POLICY IF EXISTS resource_access_select_policy ON public."ResourceAccess";
DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
DROP POLICY IF EXISTS concept_contributors_policy ON public."concept_contributors";
DROP POLICY IF EXISTS content_contributors_policy ON public."content_contributors";

DROP FUNCTION IF EXISTS public.editor_in_space(bigint);


CREATE OR REPLACE VIEW public.my_spaces AS
SELECT
    id,
    url,
    name,
    platform
FROM public."Space" WHERE id = any(public.my_space_ids('partial'));

CREATE OR REPLACE VIEW public.my_documents AS
SELECT
    id,
    space_id,
    source_local_id,
    url,
    "created",
    metadata,
    last_modified,
    author_id,
    contents
FROM
    public."Document" WHERE space_id = any(public.my_space_ids('reader'))
OR public.can_view_specific_resource(space_id, source_local_id);

CREATE OR REPLACE VIEW public.my_contents AS
SELECT
    id,
    document_id,
    source_local_id,
    variant,
    author_id,
    creator_id,
    created,
    text,
    metadata,
    scale,
    space_id,
    last_modified,
    part_of_id
FROM public."Content"
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR public.can_view_specific_resource(space_id, source_local_id)
);

CREATE OR REPLACE VIEW public.my_concepts AS
SELECT
    id,
    epistemic_status,
    name,
    description,
    author_id,
    created,
    last_modified,
    space_id,
    arity,
    schema_id,
    literal_content,
    reference_content,
    refs,
    is_schema,
    source_local_id
FROM public."Concept"
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR public.can_view_specific_resource(space_id, source_local_id)
);

CREATE OR REPLACE VIEW public.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS
SELECT
    ct.id,
    ct.document_id,
    ct.source_local_id,
    ct.variant,
    ct.author_id,
    ct.creator_id,
    ct.created,
    ct.text,
    ct.metadata,
    ct.scale,
    ct.space_id,
    ct.last_modified,
    ct.part_of_id,
    emb.model,
    emb.vector
FROM public."Content" AS ct
    JOIN public."ContentEmbedding_openai_text_embedding_3_small_1536" AS emb ON (ct.id = emb.target_id)
WHERE ct.space_id = any(public.my_space_ids('reader')) AND NOT emb.obsolete;

CREATE OR REPLACE VIEW public.my_file_references AS
SELECT
    source_local_id,
    space_id,
    filepath,
    filehash,
    created,
    last_modified
FROM public."FileReference"
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR public.can_view_specific_resource(space_id, source_local_id)
);

ALTER TABLE public."SpaceAccess" DROP COLUMN editor;


DROP FUNCTION public.in_space(bigint);
DROP FUNCTION public.my_space_ids();
DROP FUNCTION public."concept_in_space"(concept_id bigint);
DROP FUNCTION public."content_in_space"(content_id bigint);

CREATE POLICY "concept_delete_policy" ON "public"."Concept"
FOR DELETE USING (in_space(space_id));

CREATE POLICY "concept_insert_policy" ON "public"."Concept"
FOR INSERT WITH CHECK (in_space(space_id));

CREATE POLICY "concept_select_policy" ON "public"."Concept"
FOR SELECT USING ((in_space(space_id) OR can_view_specific_resource(space_id, source_local_id)));

CREATE POLICY "concept_update_policy" ON "public"."Concept"
FOR UPDATE USING (in_space(space_id));

CREATE POLICY "content_delete_policy" ON "public"."Content"
FOR DELETE USING (in_space(space_id));

CREATE POLICY "content_insert_policy" ON "public"."Content"
FOR INSERT WITH CHECK (in_space(space_id));

CREATE POLICY "content_select_policy" ON "public"."Content"
FOR SELECT USING ((in_space(space_id) OR can_view_specific_resource(space_id, source_local_id)));

CREATE POLICY "content_update_policy" ON "public"."Content"
FOR UPDATE USING (in_space(space_id));

CREATE POLICY "embedding_openai_te3s_1536_policy" ON "public"."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR ALL USING (content_in_space(target_id));

CREATE POLICY "document_delete_policy" ON "public"."Document"
FOR DELETE USING (in_space(space_id));

CREATE POLICY "document_insert_policy" ON "public"."Document"
FOR INSERT WITH CHECK (in_space(space_id));

CREATE POLICY "document_select_policy" ON "public"."Document"
FOR SELECT USING ((in_space(space_id) OR can_view_specific_resource(space_id, source_local_id)));

CREATE POLICY "document_update_policy" ON "public"."Document"
FOR UPDATE USING (in_space(space_id));

CREATE POLICY "file_reference_delete_policy" ON "public"."FileReference"
FOR DELETE USING (in_space(space_id));

CREATE POLICY "file_reference_insert_policy" ON "public"."FileReference"
FOR INSERT WITH CHECK (in_space(space_id));

CREATE POLICY "file_reference_select_policy" ON "public"."FileReference"
FOR SELECT USING ((in_space(space_id) OR can_view_specific_resource(space_id, source_local_id)));

CREATE POLICY "file_reference_update_policy" ON "public"."FileReference"
FOR UPDATE USING (in_space(space_id));

CREATE POLICY "local_access_select_policy" ON "public"."LocalAccess"
FOR SELECT USING (in_space(space_id));

CREATE POLICY "resource_access_select_policy" ON "public"."ResourceAccess"
FOR SELECT USING ((in_space(space_id) OR can_access_account(account_uid)));

CREATE POLICY "space_access_select_policy" ON "public"."SpaceAccess"
FOR SELECT USING (in_space(space_id));

CREATE POLICY "concept_contributors_policy" ON "public"."concept_contributors"
FOR ALL USING (concept_in_space(concept_id));

CREATE POLICY "content_contributors_policy" ON "public"."content_contributors"
FOR ALL USING (content_in_space(content_id));

CREATE POLICY resource_access_delete_policy ON public."ResourceAccess" FOR DELETE USING (public.in_space(space_id, 'editor') OR public.can_access_account(account_uid));
CREATE POLICY resource_access_insert_policy ON public."ResourceAccess" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));
CREATE POLICY resource_access_update_policy ON public."ResourceAccess" FOR UPDATE USING (public.in_space(space_id, 'editor'));
CREATE POLICY space_select_policy ON public."Space" FOR SELECT USING (public.in_space(id, 'partial'));
CREATE POLICY space_delete_policy ON public."Space" FOR DELETE USING (public.in_space(id, 'editor'));
CREATE POLICY space_update_policy ON public."Space" FOR DELETE USING (public.in_space(id, 'editor'));
CREATE POLICY space_insert_policy ON public."Space" FOR INSERT WITH CHECK (true);
