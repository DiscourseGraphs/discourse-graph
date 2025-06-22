# Sync information

The `sync_info` table is meant to always be accessed through one of these two functions: `propose_sync_task` and `end_sync_task`.
This acts as a semaphore, so that two workers (e.g. the roam plugin on two different browsers) do not try to run the same sync task at the same time. So you need to give the function `propose_sync_task` enough information to distinguish what you mean to do:

1. The `target`, e.g. the database Id of the scope of the task, usually a space, but it could be a single content or concept (for reactive updates)
2.  a `function` name, to distinguish different tasks on the same target; e.g. adding vs deleting content. (arbitrary short string)
3.  the `worker` name: random string, should be the same between calls.

Further, you may specify the `timeout` (>= 1s) after which the task should be deemed to have failed. The `task_interval` (>=5s) which is how often to do the task. (This must be longer than the `timeout`.)

When a worker calls `propose_sync_task`, it will receive either:

1. a timestamp in the future, meaning that the task is already being run by another worker, or has been run more recently than task_interval, and this worker should not attempt to run this task again before the given timestamp;
2. a timestamp in the past, which is also the last time the task was executed successfully. Your worker can ask the platform for all changes posterior to that time. (This will only be reliable if you make always make your queries after calling this function!)
3. Null, meaning the task was not executed successfully before, and your worker is tasked with starting from scratch.

When a worker finishes the task, it should clean up with `end_sync_task`, giving the same identifying arguments and a status ('complete' or 'failed'.)
