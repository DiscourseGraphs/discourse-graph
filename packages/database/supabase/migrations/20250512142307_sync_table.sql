CREATE TYPE task_status AS ENUM ('active', 'timeout', 'complete', 'failed');
CREATE TABLE sync_info (
    id SERIAL PRIMARY KEY,
    sync_target BIGINT,
    sync_function VARCHAR(20),
    status task_status DEFAULT 'active',
    worker varchar(100) NOT NULL,
    failure_count SMALLINT DEFAULT 0,
    last_task_start TIMESTAMP WITH TIME ZONE,
    last_task_end TIMESTAMP WITH TIME ZONE,
    task_times_out_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX sync_info_u_idx on sync_info (sync_target, sync_function);
CREATE OR REPLACE FUNCTION propose_sync_task(s_target BIGINT, s_function VARCHAR(20), s_worker varchar(100), timeout INTERVAL, task_interval INTERVAL)
    RETURNS INTERVAL AS $$
DECLARE s_id INTEGER;
DECLARE timeout_as TIMESTAMP WITH TIME ZONE;
DECLARE start_time TIMESTAMP WITH TIME ZONE;
DECLARE t_worker VARCHAR;
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
    SELECT worker, status, failure_count, last_task_start, last_task_end, task_times_out_at
        INTO t_worker, t_status, t_failure_count, t_last_task_start, t_last_task_end, t_times_out_at
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
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION end_sync_task(s_target BIGINT, s_function VARCHAR(20), s_worker varchar(100), s_status task_status) RETURNS VOID AS $$
DECLARE t_id INTEGER;
DECLARE t_target varchar;
DECLARE t_worker varchar;
DECLARE t_status task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT id, worker, status, failure_count, last_task_end
        INTO STRICT t_id, t_worker, t_status, t_failure_count, t_last_task_end
        FROM sync_info WHERE sync_target = s_target AND sync_function = s_function;
    ASSERT s_status > 'active';
    ASSERT t_worker = s_worker, "Wrong worker";
    ASSERT s_status >= t_status, "do not go back in status";
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
$$ LANGUAGE plpgsql;
