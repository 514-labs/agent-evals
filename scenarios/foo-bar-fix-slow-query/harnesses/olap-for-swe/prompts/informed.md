The slow query in `/workspace/query.sql` runs against `analytics.events` (100M rows, 5 regions, 60 days). The table is currently `MergeTree() ORDER BY event_id`, which prunes nothing for this query's filter on `(region, event_ts)`. The query also computes `uniqExact(user_id)` per day, which is real CPU work on a full scan.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, and `sum(length(user_id))` must remain identical after your fix. The result rows of the canonical query must also match exactly.

You have MooseStack and the 514 CLI available. The fix can be expressed as Moose primitives — an `OlapTable` with a sensible `orderByFields` / engine, a `MaterializedView` rolling up by `(region, toDate(event_ts))`, etc. — or as raw ClickHouse DDL through `clickhouse-client`. Either approach is acceptable; only the final state is scored. Useful commands:

- `moose query` / `moose peek` for ad-hoc EXPLAIN and inspection.
- `clickhouse-client --query 'EXPLAIN indexes=1 ...'` to verify pruning.
- Common ClickHouse-native fixes that all work here: change ORDER BY (recreate + re-INSERT), add a projection (`ALTER TABLE ... ADD PROJECTION`), or add a `MaterializedView` rolling up to `(region, day, count)`.

Document what you changed in `/workspace/README.md`.
