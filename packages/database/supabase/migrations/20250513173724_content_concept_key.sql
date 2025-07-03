-- rename constraint

alter table "public"."AutomatedAgent" drop constraint "person_id_fkey";
alter table "public"."AutomatedAgent" add constraint "automated_agent_id_fkey" FOREIGN KEY (id) REFERENCES "Agent"(id) ON UPDATE CASCADE ON DELETE CASCADE;
-- now handled by sync_table

alter table "public"."Concept" drop column "last_synced";
alter table "public"."Content" drop column "last_synced";
alter table "public"."Document" drop column "last_synced";
-- transfer of column

alter table "public"."Concept" add column "represented_by_id" bigint;
alter table "public"."Concept" add constraint "Concept_represented_by_id_fkey" FOREIGN KEY (represented_by_id) REFERENCES "Content"(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE UNIQUE INDEX "Concept_represented_by" ON public."Concept" (represented_by_id);
-- transfer data

UPDATE public."Concept" SET represented_by_id = public."Content".id
    FROM public."Content"
    WHERE public."Concept".id=represents_id;
-- drop the Content column

alter table "public"."Content" drop constraint "Content_represents_id_fkey";
drop index if exists "public"."Content_represents";
alter table "public"."Content" drop column "represents_id";
-- Content embedding functions

set check_function_bodies = off;
-- strangely the check fails to interpret <=>, despite the vector extension being installed.

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
FROM "public"."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce
JOIN "public"."Content" AS c ON ce.target_id = c.id
WHERE 1 - (ce.vector <=> query_embedding) > match_threshold
  AND ce.obsolete = FALSE
ORDER BY
  ce.vector <=> query_embedding ASC
LIMIT match_count;
$function$;
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
  FROM "public"."Content" AS c
  JOIN "public"."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce ON c.id = ce.target_id
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
set check_function_bodies = on;
