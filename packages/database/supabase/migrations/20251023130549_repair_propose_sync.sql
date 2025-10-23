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
        SELECT max(last_task_start) INTO result FROM public.sync_info
            WHERE sync_target = s_target
            AND sync_function = s_function
            AND status = 'complete';
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
