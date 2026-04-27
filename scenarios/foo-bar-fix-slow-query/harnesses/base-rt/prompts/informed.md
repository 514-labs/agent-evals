The slow query in `/workspace/query.sql` runs against `analytics.events` (100M rows, 5 regions, 60 days). The table is currently `MergeTree() ORDER BY event_id`, which prunes nothing for this query's filter on `(region, event_ts)`. The query also computes `uniqExact(user_id)` per day, which is real CPU work on a full scan.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, and `sum(length(user_id))` must remain identical after your fix. The result rows of the canonical query must also match exactly.

Common ClickHouse-native fixes that work here:
- Recreate the table (or use `ALTER TABLE ... MODIFY ORDER BY`) with a sort key whose prefix matches the filter, e.g. `ORDER BY (region, event_ts, event_id)`, and re-INSERT the data.
- `ALTER TABLE analytics.events ADD PROJECTION p_region_ts (SELECT * ORDER BY region, event_ts)` then `MATERIALIZE PROJECTION`.
- Add a `MaterializedView` (e.g. `SummingMergeTree` or `AggregatingMergeTree`) pre-aggregating to `(region, toDate(event_ts), count)` so the query reads a tiny rollup.

Use `clickhouse-client --query 'EXPLAIN indexes=1 ...'` to verify the optimizer is reading fewer granules. Document what you changed in `/workspace/README.md`.
