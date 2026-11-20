-- Same form as my_concepts: a single SELECT from the base table, since PostgREST cannot infer foreign keys through a UNION.
-- (SELECT ...) runs each space lookup once per query, not per row; ::bigint [] keeps = any() an array comparison.
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
    contents,
    content_type
FROM public."Document"
WHERE
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    );

-- Single-table views are writable, and writes run as the view owner, bypassing Document's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_documents FROM anon, authenticated;

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
    part_of_id,
    content_type,
    original
FROM public."Content"
WHERE
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    );

-- Single-table views are writable, and writes run as the view owner, bypassing Content's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_contents FROM anon, authenticated;

CREATE OR REPLACE VIEW public.my_file_references AS
SELECT
    source_local_id,
    space_id,
    filepath,
    filehash,
    created,
    last_modified,
    source_path
FROM public."FileReference"
WHERE
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    );

-- Single-table views are writable, and writes run as the view owner, bypassing FileReference's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_file_references FROM anon, authenticated;

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
ct.content_type,
ct.original,
emb.model,
emb.vector
FROM public."Content" AS ct
JOIN public."ContentEmbedding_openai_text_embedding_3_small_1536" AS emb ON (ct.id = emb.target_id)
WHERE
(
ct.space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
OR (
ct.space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
AND (ct.space_id, ct.source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
)
)
AND NOT emb.obsolete;
