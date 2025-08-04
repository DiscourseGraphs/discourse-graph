set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes(p_query_embedding vector, p_subset_roam_uids text[])
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'extensions'
AS $function$
WITH initial_content AS (
  -- Step 1: Find the initial content entries for the given UIDs to get their document_ids
  SELECT
    id,
    source_local_id,
    text,
    document_id
  FROM
    public."Content"
  WHERE
    source_local_id = ANY (p_subset_roam_uids)
), latest_doc_content AS (
  -- Step 2: For each document, find the content with the highest ID
  SELECT
    document_id,
    MAX(id) AS latest_content_id
  FROM
    public."Content"
  WHERE
    document_id IN (
      SELECT
        document_id
      FROM
        initial_content)
    GROUP BY
      document_id
)
-- Final Step: Join back to initial content to keep original UIDs, join to get embeddings, and calculate similarity
SELECT
  ic.id AS content_id,
  ic.source_local_id AS roam_uid,
  ic.text AS text_content,
  1 - (ce.vector <=> p_query_embedding) AS similarity
FROM
  initial_content ic
  JOIN latest_doc_content ldc ON ic.document_id = ldc.document_id
  JOIN public."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce ON ldc.latest_content_id = ce.target_id
WHERE
  ce.obsolete = FALSE
ORDER BY
  similarity DESC;
$function$
;


