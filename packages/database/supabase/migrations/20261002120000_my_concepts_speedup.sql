-- Single SELECT from Concept: PostgREST cannot infer foreign keys through a UNION.
-- (SELECT ...) runs each space lookup once per query, not per row; ::bigint [] keeps = any() an array comparison.
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
    source_local_id,
    is_relation
FROM public."Concept"
WHERE
    space_id = any((SELECT public.my_space_ids('reader'))::bigint [])
    OR (
        space_id = any((SELECT public.my_space_ids('partial'))::bigint [])
        AND (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.my_accessible_resources())
    );

-- Single-table views are writable, and writes run as the view owner, bypassing Concept's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_concepts FROM anon, authenticated;
