CREATE TYPE public."EmbeddingName" AS ENUM (
    'openai_text_embedding_ada2_1536',
    'openai_text_embedding_3_small_512',
    'openai_text_embedding_3_small_1536',
    'openai_text_embedding_3_large_256',
    'openai_text_embedding_3_large_1024',
    'openai_text_embedding_3_large_3072'
);

ALTER TYPE public."EmbeddingName" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS public."ContentEmbedding_openai_text_embedding_3_small_1536" (
target_id bigint NOT NULL,
"model" public."EmbeddingName" DEFAULT 'openai_text_embedding_3_small_1536'::public."EmbeddingName" NOT NULL,
"vector" extensions.vector (1536) NOT NULL,
obsolete boolean DEFAULT false
) ;

ALTER TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" OWNER TO "postgres" ;

ALTER TABLE ONLY public."ContentEmbedding_openai_text_embedding_3_small_1536"
ADD CONSTRAINT "ContentEmbedding_openai_text_embedding_3_small_1536_pkey" PRIMARY KEY (target_id) ;

ALTER TABLE ONLY public."ContentEmbedding_openai_text_embedding_3_small_1536"
ADD CONSTRAINT "ContentEmbedding_openai_text_embedding_3_small_1_target_id_fkey" FOREIGN KEY (target_id) REFERENCES public."Content" (id) ON UPDATE CASCADE ON DELETE CASCADE ;

GRANT ALL ON TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" TO "anon" ;
GRANT ALL ON TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" TO "authenticated" ;
GRANT ALL ON TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" TO "service_role" ;

set search_path to public, extensions ;

CREATE OR REPLACE FUNCTION public.match_content_embeddings (
query_embedding extensions.vector,
match_threshold double precision,
match_count integer,
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
  1 - (ce.vector <=> query_embedding) AS similarity
FROM public."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce
JOIN public."Content" AS c ON ce.target_id = c.id
WHERE 1 - (ce.vector <=> query_embedding) > match_threshold
  AND ce.obsolete = FALSE
  AND (current_document_id IS NULL OR c.document_id = current_document_id)
ORDER BY
  ce.vector <=> query_embedding ASC
LIMIT match_count;
$$ ;

ALTER FUNCTION public.match_content_embeddings (
query_embedding extensions.vector,
match_threshold double precision,
match_count integer,
current_document_id integer) OWNER TO "postgres" ;

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes (
"p_query_embedding" extensions.vector,
"p_subset_roam_uids" Text [])
RETURNS TABLE (content_id bigint,
roam_uid Text,
text_content Text,
similarity double precision)
LANGUAGE sql STABLE
SET search_path = 'extensions'
AS $$
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
$$ ;

ALTER FUNCTION public.match_embeddings_for_subset_nodes (
"p_query_embedding" extensions.vector, "p_subset_roam_uids" Text [])
OWNER TO "postgres" ;

RESET ALL ;
