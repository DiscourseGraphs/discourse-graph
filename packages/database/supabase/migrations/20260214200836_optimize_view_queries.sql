CREATE TYPE public.accessible_resource AS (
    space_id bigint,
    source_local_id character varying
);

CREATE OR REPLACE FUNCTION public.my_accessible_resources() RETURNS SETOF public.accessible_resource
STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT DISTINCT space_id, source_local_id FROM public."ResourceAccess"
    JOIN public.my_user_accounts() ON (account_uid = my_user_accounts);
$$;

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
    public."Document"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
);

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
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
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
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
);

CREATE OR REPLACE VIEW public.my_file_references AS
SELECT
    source_local_id,
    space_id,
    filepath,
    filehash,
    created,
    last_modified
FROM public."FileReference"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
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
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    ct.space_id = any(public.my_space_ids('reader'))
    OR (ct.space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
)
AND NOT emb.obsolete;

CREATE OR REPLACE FUNCTION public.can_view_content(content_id BIGINT) RETURNS BOOLEAN
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.can_view_specific_resource(space_id, source_local_id) FROM public."Content" WHERE id=content_id;
$$;

DROP POLICY IF EXISTS embedding_openai_te3s_1536_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
DROP POLICY IF EXISTS embedding_openai_te3s_1536_select_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_select_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR SELECT USING (public.content_in_space(target_id) OR public.can_view_content(target_id));
DROP POLICY IF EXISTS embedding_openai_te3s_1536_delete_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_delete_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR DELETE USING (public.content_in_space(target_id));
DROP POLICY IF EXISTS embedding_openai_te3s_1536_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR INSERT WITH CHECK (public.content_in_space(target_id));
DROP POLICY IF EXISTS embedding_openai_te3s_1536_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536";
CREATE POLICY embedding_openai_te3s_1536_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536"
FOR UPDATE USING (public.content_in_space(target_id));
