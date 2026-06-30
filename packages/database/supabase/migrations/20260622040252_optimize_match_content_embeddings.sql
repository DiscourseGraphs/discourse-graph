-- Optimize match_content_embeddings by removing LIMIT from function body
-- This improves query planner performance as the LIMIT parameter was killing the planner

set search_path to public, extensions ;

DROP FUNCTION IF EXISTS public.match_content_embeddings(extensions.vector, double precision, integer, integer) ;

CREATE OR REPLACE FUNCTION public.match_content_embeddings (
query_embedding extensions.vector,
match_threshold double precision,
current_document_id integer DEFAULT NULL::integer)
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
ORDER BY
  c.vector <=> query_embedding ASC;
$$ ;

RESET ALL ;
