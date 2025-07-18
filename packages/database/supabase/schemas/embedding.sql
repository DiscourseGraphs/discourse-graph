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
  "p_subset_roam_uids" text[]
) RETURNS TABLE (
  content_id bigint,
  roam_uid text,
  text_content text,
  similarity double precision
) LANGUAGE sql STABLE SET search_path = 'extensions' AS $$
WITH initial_content AS (
  -- Step 1: Find the initial content entries for the given UIDs
  SELECT
    c.id,
    c.source_local_id,
    c.text,
    c.document_id
  FROM
    public."Content" c
  WHERE
    c.source_local_id = ANY (p_subset_roam_uids)
),
document_content_counts AS (
  -- Step 2: Count content items per document for documents linked to our initial content
  SELECT
    document_id,
    COUNT(id) AS content_count
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
),
special_case_documents AS (
  -- Step 3: Identify documents that are special cases (exactly 2 content items)
  SELECT
    document_id
  FROM
    document_content_counts
  WHERE
    content_count = 2
),
block_content_for_special_docs AS (
  -- Step 4: Find the 'block' scaled content for these special case documents
  SELECT
    c.document_id,
    c.id AS block_content_id
  FROM
    public."Content" c
  WHERE
    c.document_id IN (
      SELECT
        document_id
      FROM
        special_case_documents)
      AND c.scale = 'block'
),
content_with_embedding_source AS (
  -- Step 5: Determine which content ID to use for fetching the embedding
  SELECT
    ic.id AS original_content_id,
    ic.source_local_id AS roam_uid,
    ic.text AS text_content,
    COALESCE(bcsd.block_content_id, ic.id) AS embedding_target_id
  FROM
    initial_content ic
  LEFT JOIN
    block_content_for_special_docs bcsd
    ON ic.document_id = bcsd.document_id
)
-- Final Step: Join to get embeddings, calculate similarity, and return the results
SELECT
  cwes.original_content_id AS content_id,
  cwes.roam_uid,
  cwes.text_content,
  1 - (ce.vector <=> p_query_embedding) AS similarity
FROM
  content_with_embedding_source cwes
JOIN
  public."ContentEmbedding_openai_text_embedding_3_small_1536" AS ce
  ON cwes.embedding_target_id = ce.target_id
WHERE
  ce.obsolete = FALSE
ORDER BY
  similarity DESC;
$$;

ALTER FUNCTION public.match_embeddings_for_subset_nodes (
"p_query_embedding" extensions.vector, "p_subset_roam_uids" Text [])
OWNER TO "postgres" ;

RESET ALL ;
