CREATE TYPE public.task_status AS ENUM (
    'active',
    'timeout',
    'complete',
    'failed'
);

ALTER TYPE public.task_status OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS public.sync_info (
    id integer NOT NULL,
    sync_target bigint,
    target_type public."EntityType" NOT NULL DEFAULT 'Space'::public."EntityType",
    sync_function character varying(20),
    status public.task_status DEFAULT 'active'::public.task_status,
    worker character varying(100) NOT NULL,
    failure_count smallint DEFAULT 0,
    last_task_start timestamp with time zone,
    last_task_end timestamp with time zone,
    task_times_out_at timestamp with time zone
);

ALTER TABLE public.sync_info OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS public.sync_info_id_seq
AS integer
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

ALTER TABLE public.sync_info_id_seq OWNER TO "postgres";

ALTER SEQUENCE public.sync_info_id_seq OWNED BY public.sync_info.id;

ALTER TABLE ONLY public.sync_info ALTER COLUMN id SET DEFAULT nextval(
    'public.sync_info_id_seq'::regclass
);

ALTER TABLE ONLY public.sync_info
ADD CONSTRAINT sync_info_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX sync_info_u_idx ON public.sync_info USING btree (
    "sync_target", sync_function
);

CREATE OR REPLACE FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status
) RETURNS void
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE t_id INTEGER;
DECLARE t_worker varchar;
DECLARE t_status public.task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT id, worker, status, failure_count, last_task_end
        INTO STRICT t_id, t_worker, t_status, t_failure_count, t_last_task_end
        FROM public.sync_info WHERE sync_target = s_target AND sync_function = s_function;
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

    UPDATE public.sync_info
        SET status = s_status,
            task_times_out_at=null,
            last_task_end=t_last_task_end,
            failure_count=t_failure_count
        WHERE id=t_id;
END;
$$;

ALTER FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status
) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION public.propose_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    "timeout" interval,
    "task_interval" interval
) RETURNS timestamp with time zone
SET search_path = ''
LANGUAGE plpgsql
AS $$
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
$$;

ALTER FUNCTION public.propose_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    "timeout" interval,
    "task_interval" interval
) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.get_nodes_needing_sync(nodes_from_roam jsonb)
RETURNS TABLE (uid_to_sync text)
SET search_path = ''
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

GRANT ALL ON TABLE public.sync_info TO "anon";
GRANT ALL ON TABLE public.sync_info TO "authenticated";
GRANT ALL ON TABLE public.sync_info TO "service_role";

GRANT ALL ON SEQUENCE public.sync_info_id_seq TO "anon";
GRANT ALL ON SEQUENCE public.sync_info_id_seq TO "authenticated";
GRANT ALL ON SEQUENCE public.sync_info_id_seq TO "service_role";

GRANT ALL ON FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status
) TO "anon";
GRANT ALL ON FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status
) TO "authenticated";
GRANT ALL ON FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status
) TO "service_role";

GRANT ALL ON FUNCTION public.propose_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    "timeout" interval,
    "task_interval" interval
) TO "anon";
GRANT ALL ON FUNCTION public.propose_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    "timeout" interval,
    "task_interval" interval
) TO "authenticated";
GRANT ALL ON FUNCTION public.propose_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    "timeout" interval,
    "task_interval" interval
) TO "service_role";

GRANT ALL ON FUNCTION public.get_nodes_needing_sync(nodes_from_roam jsonb) TO "anon";
GRANT ALL ON FUNCTION public.get_nodes_needing_sync(nodes_from_roam jsonb) TO "authenticated";
GRANT ALL ON FUNCTION public.get_nodes_needing_sync(nodes_from_roam jsonb) TO "service_role";

RESET ALL;
