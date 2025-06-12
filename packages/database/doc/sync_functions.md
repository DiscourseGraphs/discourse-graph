# Sync information

The `sync_info` table is meant to always be accessed through one of these two functions: `propose_sync_task` and `end_sync_task`.
This acts as a semaphore, so that two workers (e.g. the roam plugin on two different browsers) do not try to run the same sync task at the same time. So you need to give the function `propose_sync_task` enough information to distinguish what you mean to do:

1. The `target`, e.g. the database Id of the scope of the task, usually a space, but it could be a single content or concept (for reactive updates)
2.  a `function` name, to distinguish different tasks on the same target; e.g. adding vs deleting content. (arbitrary short string)
3.  the `worker` name: random string, should be the same between calls.

Further, you may specify the `timeout` after which the task should be deemed to have failed; and the `task_interval` which is how often to do the task. (This must be longer than the `timeout`.)

When a worker calls `propose_sync_task`, it will either receive NULL, meaning it _should_ get started on the task, or an interval indicating how long it should wait before asking again to do it (presumably because another worker is doing the task now, or has done it not so long ago as `task_interval`.)

When a worker finishes the task, it should clean up with `end_sync_task`, giving the same identifying arguments and a status ('complete' or 'failed'.)

