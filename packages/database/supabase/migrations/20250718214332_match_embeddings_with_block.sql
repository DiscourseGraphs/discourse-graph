set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes(p_query_embedding vector, p_subset_roam_uids text[])
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'extensions'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.propose_sync_task(s_target bigint, s_function character varying, s_worker character varying, timeout interval, task_interval interval)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE s_id INTEGER;
DECLARE start_time TIMESTAMP WITH TIME ZONE := now();
DECLARE t_status public.task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_start TIMESTAMP WITH TIME ZONE;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
DECLARE t_times_out_at TIMESTAMP WITH TIME ZONE;
DECLARE result TIMESTAMP WITH TIME ZONE;
BEGIN
    ASSERT timeout * 2 < task_interval;
    ASSERT timeout >= '1s'::interval;
    ASSERT task_interval >= '5s'::interval;
    INSERT INTO public.sync_info (sync_target, sync_function, status, worker, last_task_start, task_times_out_at)
        VALUES (s_target, s_function, 'active', s_worker, start_time, start_time+timeout)
        ON CONFLICT (sync_target, sync_function) DO NOTHING
        RETURNING id INTO s_id;
    IF s_id IS NOT NULL THEN
        -- totally new_row, I'm on the task
        -- return last time it was run successfully
        SELECT max(last_task_start) INTO result FROM public.sync_info
            WHERE sync_target = s_target
            AND sync_function = s_function
            AND status = 'complete';
        RETURN result;
    END IF;
    -- now we know it pre-existed. Maybe already active.
    SELECT id INTO STRICT s_id FROM public.sync_info WHERE sync_target = s_target AND sync_function = s_function;
    PERFORM pg_advisory_lock(s_id);
    SELECT status, failure_count, last_task_start, last_task_end, task_times_out_at
        INTO t_status, t_failure_count, t_last_task_start, t_last_task_end, t_times_out_at
        FROM public.sync_info
        WHERE id = s_id;

    IF t_status = 'active' AND t_last_task_start >= coalesce(t_last_task_end, t_last_task_start) AND start_time > t_times_out_at THEN
        t_status := 'timeout';
        t_failure_count := t_failure_count + 1;
    END IF;
    -- basic backoff
    task_interval := task_interval * (1+t_failure_count);
    IF coalesce(t_last_task_end, t_last_task_start) + task_interval < now() THEN
        -- we are ready to take on the task
        result := t_last_task_start;
        UPDATE public.sync_info
        SET worker=s_worker, status='active', task_times_out_at = now() + timeout, last_task_start = start_time, failure_count=t_failure_count
        WHERE id=s_id;
    ELSE
        -- the task has been tried recently enough
        IF t_status = 'timeout' THEN
            UPDATE public.sync_info
            SET status=t_status, failure_count=t_failure_count
            WHERE id=s_id;
        END IF;
        result := coalesce(t_last_task_end, t_last_task_start) + task_interval;
    END IF;

    PERFORM pg_advisory_unlock(s_id);
    RETURN result;
END;
$function$
;


