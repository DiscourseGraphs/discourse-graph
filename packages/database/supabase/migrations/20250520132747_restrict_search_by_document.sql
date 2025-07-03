CREATE OR REPLACE FUNCTION public.match_content_embeddings(query_embedding vector, match_threshold double precision, match_count integer, current_document_id integer DEFAULT NULL::integer)
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
SELECT
  c.id AS content_id,
  c.source_local_id AS roam_uid,
  c.text AS text_content,
  1 - (ce.vector <=> query_embedding) AS similarity
FROM public."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce
JOIN public."Content" AS c ON ce.target_id = c.id
WHERE 1 - (ce.vector <=> query_embedding) > match_threshold
  AND ce.obsolete = FALSE
  AND (current_document_id IS NULL OR c.document_id = current_document_id)
ORDER BY
  ce.vector <=> query_embedding ASC
LIMIT match_count;
$function$;
-- Supabase wants to replace this function for no obvious reason. Letting it.

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes(p_query_embedding vector, p_subset_roam_uids text[])
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
WITH subset_content_with_embeddings AS (
  -- Step 1: Identify content and fetch embeddings ONLY for the nodes in the provided Roam UID subset
  SELECT
    c.id AS content_id,
    c.source_local_id AS roam_uid,
    c.text AS text_content,
    ce.vector AS embedding_vector
  FROM public."Content" AS c
  JOIN public."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce ON c.id = ce.target_id
  WHERE
    c.source_local_id = ANY(p_subset_roam_uids) -- Filter Content by the provided Roam UIDs
    AND ce.obsolete = FALSE
)
SELECT
  ss_ce.content_id,
  ss_ce.roam_uid,
  ss_ce.text_content,
  1 - (ss_ce.embedding_vector <=> p_query_embedding) AS similarity
FROM subset_content_with_embeddings AS ss_ce
ORDER BY similarity DESC; -- Order by calculated similarity, highest first
$function$;
