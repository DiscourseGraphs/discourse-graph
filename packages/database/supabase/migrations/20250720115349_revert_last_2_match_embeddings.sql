drop policy "embedding_openai_te3s_1536_policy" on "public"."ContentEmbedding_openai_text_embedding_3_small_1536";

alter table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" disable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes(p_query_embedding vector, p_subset_roam_uids text[])
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'extensions'
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
$function$
;

grant delete on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";

grant insert on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";

grant references on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";

grant select on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";

grant trigger on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";

grant truncate on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";

grant update on table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" to "anon";


