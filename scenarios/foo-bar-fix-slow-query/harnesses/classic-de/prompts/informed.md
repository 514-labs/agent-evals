The slow query in `/workspace/query.sql` runs against `analytics.events` (100M rows, 5 regions, 60 days). The table is currently `MergeTree() ORDER BY event_id`, which prunes nothing for this query's filter on `(region, event_ts)`. The query also computes `uniqExact(user_id)` per day, which is real CPU work on a full scan.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, and `sum(length(user_id))` must remain identical after your fix. The result rows of the canonical query must also match exactly.

This is a single-engine ClickHouse problem — Airflow and Spark are available but unlikely to help. dbt is well-suited: you can model the optimization as a dbt model (e.g. `materialized='materialized_view'` with appropriate engine config) or run the DDL via `dbt run-operation`. Common ClickHouse-native fixes:

- Recreate the table with `ORDER BY (region, event_ts, event_id)` and re-INSERT.
- `ALTER TABLE analytics.events ADD PROJECTION p_region_ts (SELECT * ORDER BY region, event_ts)` + `MATERIALIZE PROJECTION`.
- Add a rollup `MaterializedView` keyed by `(region, toDate(event_ts))` so the query reads a tiny pre-aggregated table.

Use `clickhouse-client --query 'EXPLAIN indexes=1 ...'` to verify pruning. Document what you changed in `/workspace/README.md`.
