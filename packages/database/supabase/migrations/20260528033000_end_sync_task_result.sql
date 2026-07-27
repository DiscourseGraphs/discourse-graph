DROP FUNCTION IF EXISTS public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status,
    s_started_at timestamptz);

CREATE OR REPLACE FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status,
    s_started_at timestamptz = NULL
) RETURNS jsonb
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE t_id INTEGER;
DECLARE t_worker varchar;
DECLARE t_status public.task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_start TIMESTAMP WITH TIME ZONE;
DECLARE t_last_success_start TIMESTAMP WITH TIME ZONE;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
DECLARE t_task_times_out_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT id, worker, status, failure_count, last_task_start, last_task_end, last_success_start, task_times_out_at
        INTO STRICT t_id, t_worker, t_status, t_failure_count, t_last_task_start, t_last_task_end, t_last_success_start, t_task_times_out_at
        FROM public.sync_info WHERE sync_target = s_target AND sync_function = s_function
        FOR UPDATE;
    ASSERT s_status > 'active';
    IF t_worker != s_worker AND COALESCE(s_started_at, t_last_task_start) < t_last_task_start THEN
        -- we probably took too long. Let the other task have priority.
        RETURN jsonb_build_object(
            'version', 1,
            'ok', false,
            'stale', true,
            'reason', 'completed_by_newer_task',
            'requestedStatus', s_status,
            'callerWorker', s_worker,
            'currentWorker', t_worker,
            'currentStatus', t_status,
            'callerStartedAt', s_started_at,
            'currentStartedAt', t_last_task_start,
            'lastTaskEnd', t_last_task_end,
            'lastSuccessStart', t_last_success_start,
            'taskTimesOutAt', t_task_times_out_at,
            'failureCount', t_failure_count
        );
    END IF;
    IF t_worker != s_worker THEN
        RAISE EXCEPTION 'Wrong worker'
            USING DETAIL = jsonb_build_object(
                'version', 1,
                'requestedStatus', s_status,
                'callerWorker', s_worker,
                'currentWorker', t_worker,
                'currentStatus', t_status,
                'callerStartedAt', s_started_at,
                'currentStartedAt', t_last_task_start,
                'lastTaskEnd', t_last_task_end,
                'lastSuccessStart', t_last_success_start,
                'taskTimesOutAt', t_task_times_out_at,
                'failureCount', t_failure_count
            )::text;
    END IF;
    ASSERT s_status >= t_status, 'do not go back in status';
    IF s_status = 'complete' THEN
        t_last_task_end := now();
        t_last_success_start := t_last_task_start;
        t_failure_count := 0;
    ELSE
        IF t_status != s_status THEN
            t_failure_count := t_failure_count + 1;
        END IF;
    END IF;

    t_task_times_out_at := NULL;
    UPDATE public.sync_info
        SET status = s_status,
            task_times_out_at=null,
            last_task_end=t_last_task_end,
            last_success_start=t_last_success_start,
            failure_count=t_failure_count
        WHERE id=t_id;

    RETURN jsonb_build_object(
        'version', 1,
        'ok', true,
        'stale', false,
        'requestedStatus', s_status,
        'callerWorker', s_worker,
        'currentWorker', t_worker,
        'currentStatus', t_status,
        'callerStartedAt', s_started_at,
        'currentStartedAt', t_last_task_start,
        'lastTaskEnd', t_last_task_end,
        'lastSuccessStart', t_last_success_start,
        'taskTimesOutAt', t_task_times_out_at,
        'failureCount', t_failure_count
    );
END;
$$;

ALTER FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status,
    s_started_at timestamptz
) OWNER TO "postgres";

GRANT ALL ON FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status,
    s_started_at timestamptz
) TO "anon";
GRANT ALL ON FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status,
    s_started_at timestamptz
) TO "authenticated";
GRANT ALL ON FUNCTION public.end_sync_task(
    s_target bigint,
    s_function character varying,
    s_worker character varying,
    s_status public.task_status,
    s_started_at timestamptz
) TO "service_role";
