drop function if exists "public"."alpha_delete_by_source_local_ids"(p_space_name text, p_source_local_ids text[]);

drop function if exists "public"."alpha_get_last_update_time"(p_space_name text);

drop function if exists "public"."alpha_upsert_discourse_nodes"(p_space_name text, p_user_email text, p_user_name text, p_nodes jsonb);

drop function if exists "public"."upsert_discourse_nodes"(p_space_name text, p_user_email text, p_user_name text, p_nodes jsonb, p_platform_name text, p_platform_url text, p_space_url text, p_agent_type text, p_content_scale text, p_embedding_model text, p_document_source_id text);

create table "public"."access-token" (
    "id" bigint generated always as identity not null,
    "access-token" text not null,
    "code" text,
    "state" text,
    "created_date" timestamp with time zone not null default timezone('utc'::text, now())
);


CREATE UNIQUE INDEX "access-token_pkey" ON public."access-token" USING btree (id);

CREATE UNIQUE INDEX access_token_access_token_idx ON public."access-token" USING btree ("access-token");

CREATE INDEX access_token_code_idx ON public."access-token" USING btree (code);

CREATE INDEX access_token_created_date_idx ON public."access-token" USING btree (created_date DESC);

CREATE INDEX access_token_state_idx ON public."access-token" USING btree (state);

alter table "public"."access-token" add constraint "access-token_pkey" PRIMARY KEY using index "access-token_pkey";

alter table "public"."access-token" add constraint "access_token_code_state_check" CHECK (((code IS NOT NULL) OR (state IS NOT NULL))) not valid;

alter table "public"."access-token" validate constraint "access_token_code_state_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.end_sync_task(s_target bigint, s_function character varying, s_worker character varying, s_status task_status)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE t_id INTEGER;
DECLARE t_worker varchar;
DECLARE t_status task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT id, worker, status, failure_count, last_task_end
        INTO STRICT t_id, t_worker, t_status, t_failure_count, t_last_task_end
        FROM sync_info WHERE sync_target = s_target AND sync_function = s_function;
    ASSERT s_status > 'active';
    ASSERT t_worker = s_worker, 'Wrong worker';
    ASSERT s_status >= t_status, 'do not go back in status';
    IF s_status = 'complete' THEN
        t_last_task_end := now();
        t_failure_count := 0;
    ELSE
        IF t_status != s_status THEN
            t_failure_count := t_failure_count + 1;
        END IF;
    END IF;

    UPDATE sync_info
        SET status = s_status,
            task_times_out_at=null,
            last_task_end=t_last_task_end,
            failure_count=t_failure_count
        WHERE id=t_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_nodes_needing_sync(nodes_from_roam jsonb)
 RETURNS TABLE(uid_to_sync text)
 LANGUAGE plpgsql
AS $function$
    DECLARE
        node_info jsonb;
        roam_node_uid TEXT;
        roam_node_edit_epoch_ms BIGINT;
        content_db_last_modified_epoch_ms BIGINT;
    BEGIN
        FOR node_info IN SELECT * FROM jsonb_array_elements(nodes_from_roam)
        LOOP
            roam_node_uid := (node_info->>'uid')::text;
            roam_node_edit_epoch_ms := (node_info->>'roam_edit_time')::bigint;

            -- Get the last_modified time from your Content table for the current node, converting it to epoch milliseconds
            -- Assumes your 'last_modified' column in 'Content' is a timestamp type
            SELECT EXTRACT(EPOCH FROM c.last_modified) * 1000
            INTO content_db_last_modified_epoch_ms
            FROM public."Content" c -- Ensure "Content" matches your table name exactly (case-sensitive if quoted)
            WHERE c.source_local_id = roam_node_uid;

            IF NOT FOUND THEN
                -- Node does not exist in Supabase Content table, so it needs sync
                uid_to_sync := roam_node_uid;
                RETURN NEXT;
            ELSE
                -- Node exists, compare timestamps
                IF roam_node_edit_epoch_ms > content_db_last_modified_epoch_ms THEN
                    uid_to_sync := roam_node_uid;
                    RETURN NEXT;
                END IF;
            END IF;
        END LOOP;
        RETURN;
    END;
    $function$
;

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.propose_sync_task(s_target bigint, s_function character varying, s_worker character varying, timeout interval, task_interval interval)
 RETURNS interval
 LANGUAGE plpgsql
AS $function$
DECLARE s_id INTEGER;
DECLARE start_time TIMESTAMP WITH TIME ZONE;
DECLARE t_status task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_start TIMESTAMP WITH TIME ZONE;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
DECLARE t_times_out_at TIMESTAMP WITH TIME ZONE;
DECLARE result INTERVAL = NULL;
BEGIN
    ASSERT timeout * 2 < task_interval;
    ASSERT timeout >= '1s'::interval;
    ASSERT task_interval >= '5s'::interval;
    start_time := now();
    INSERT INTO sync_info (sync_target, sync_function, status, worker, last_task_start, task_times_out_at)
        VALUES (s_target, s_function, 'active', s_worker, start_time, start_time+timeout)
        ON CONFLICT DO NOTHING
        RETURNING id INTO s_id;
    -- zut il renvoie null...
    IF s_id IS NOT NULL THEN
        -- totally new_row, I'm on the task
        RETURN NULL;
    END IF;
    -- now we know it pre-existed. Maybe already active.
    SELECT id INTO STRICT s_id FROM sync_info WHERE sync_target = s_target AND sync_function = s_function;
    PERFORM pg_advisory_lock(s_id);
    SELECT status, failure_count, last_task_start, last_task_end, task_times_out_at
        INTO t_status, t_failure_count, t_last_task_start, t_last_task_end, t_times_out_at
        FROM sync_info
        WHERE id = s_id;

    IF t_status = 'active' AND t_last_task_start >= coalesce(t_last_task_end, t_last_task_start) AND start_time > t_times_out_at THEN
        t_status := 'timeout';
        t_failure_count := t_failure_count + 1;
    END IF;
    -- basic backoff
    task_interval := task_interval * (1+t_failure_count);
    IF coalesce(t_last_task_end, t_last_task_start) + task_interval < now() THEN
        -- we are ready to take on the task
        UPDATE sync_info
        SET worker=s_worker, status='active', task_times_out_at = now() + timeout, last_task_start = now(), failure_count=t_failure_count
        WHERE id=s_id;
    ELSE
        -- the task has been tried recently enough
        IF t_status = 'timeout' THEN
            UPDATE sync_info
            SET status=t_status, failure_count=t_failure_count
            WHERE id=s_id;
        END IF;
        result := coalesce(t_last_task_end, t_last_task_start) + task_interval - now();
    END IF;

    PERFORM pg_advisory_unlock(s_id);
    RETURN result;
END;
$function$
;

grant delete on table "public"."access-token" to "anon";

grant insert on table "public"."access-token" to "anon";

grant references on table "public"."access-token" to "anon";

grant select on table "public"."access-token" to "anon";

grant trigger on table "public"."access-token" to "anon";

grant truncate on table "public"."access-token" to "anon";

grant update on table "public"."access-token" to "anon";

grant delete on table "public"."access-token" to "authenticated";

grant insert on table "public"."access-token" to "authenticated";

grant references on table "public"."access-token" to "authenticated";

grant select on table "public"."access-token" to "authenticated";

grant trigger on table "public"."access-token" to "authenticated";

grant truncate on table "public"."access-token" to "authenticated";

grant update on table "public"."access-token" to "authenticated";

grant delete on table "public"."access-token" to "service_role";

grant insert on table "public"."access-token" to "service_role";

grant references on table "public"."access-token" to "service_role";

grant select on table "public"."access-token" to "service_role";

grant trigger on table "public"."access-token" to "service_role";

grant truncate on table "public"."access-token" to "service_role";

grant update on table "public"."access-token" to "service_role";


