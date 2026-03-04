Partition the `app.events` table by `created_at` (use RANGE partitioning, monthly or daily).

The table has columns: id, created_at, event_type, payload. Create a partitioned replacement, migrate data, and swap (or rename). Ensure row count is preserved and date-range queries use partition pruning. Verify with EXPLAIN that a query like `WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'` hits only relevant partitions.
