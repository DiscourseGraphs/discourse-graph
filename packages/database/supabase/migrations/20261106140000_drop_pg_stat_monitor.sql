-- pg_stat_monitor is not in shared_preload_libraries, so it never collected
-- statistics. In production it sat in the public schema.
-- No CASCADE: the drop fails if anything has come to depend on it.
DROP EXTENSION IF EXISTS pg_stat_monitor;
