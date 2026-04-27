The slow query in `/workspace/query.sql` runs against `analytics.events` (100M rows, 5 regions, 60 days). The table is currently `MergeTree() ORDER BY event_id`, which prunes nothing for this query's filter on `(region, event_ts)`. The query also computes `uniqExact(user_id)` per day, which is real CPU work on a full scan.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, and `sum(length(user_id))` must remain identical after your fix. The result rows of the canonical query must also match exactly.

A Moose project is already scaffolded at `/workspace/moose-project`. You can model the fix as Moose primitives — declare an `OlapTable` for `analytics.events` with the desired engine / `orderByFields`, or add a `MaterializedView` rolling up by `(region, toDate(event_ts))` — and run `moose dev` / `moose deploy` to apply, or run raw ClickHouse DDL through `clickhouse-client`. Only the final state of `analytics.events` and the canonical query latency are scored.

- `moose query` / `moose peek` for ad-hoc EXPLAIN and inspection.
- `clickhouse-client --query 'EXPLAIN indexes=1 ...'` to verify pruning.
- Document what you changed in `/workspace/README.md`.
