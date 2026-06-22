-- Optimize match_content_embeddings by removing LIMIT from function body
-- This improves query planner performance as the LIMIT parameter was killing the planner
-- Also adds space_id parameter for better filtering

set search_path to public, extensions ;

CREATE OR REPLACE FUNCTION public.match_content_embeddings (
query_embedding extensions.vector,
match_threshold double precision,
current_document_id integer DEFAULT NULL::integer,
current_space_id bigint DEFAULT NULL::bigint)
RETURNS TABLE (
content_id bigint,
roam_uid Text,
text_content Text,
similarity double precision)
SET search_path = 'extensions'
LANGUAGE sql STABLE
AS $$
SELECT
  c.id AS content_id,
  c.source_local_id AS roam_uid,
  c.text AS text_content,
  1 - (c.vector <=> query_embedding) AS similarity
FROM public.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS c
WHERE 1 - (c.vector <=> query_embedding) > match_threshold
  AND (current_document_id IS NULL OR c.document_id = current_document_id)
  AND (current_space_id IS NULL OR c.space_id = current_space_id)
ORDER BY
  c.vector <=> query_embedding ASC;
$$ ;

RESET ALL ;
