The slow query in `/workspace/query.sql` runs against `analytics.events` (100M rows, 5 regions, 60 days). The table is currently `MergeTree() ORDER BY event_id`, which prunes nothing for this query's filter on `(region, event_ts)`. The query also computes `uniqExact(user_id)` per day, which is real CPU work on a full scan.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, and `sum(length(user_id))` must remain identical after your fix. The result rows of the canonical query must also match exactly.

The container has Moose installed and a scaffolded project at `/workspace/moose-project`, with `moose dev --dockerless` already running in the background against the same ClickHouse instance (HTTP `localhost:18123`, TCP `9000`, user `panda`, password `pandapass`, default DB `analytics`). `analytics.events` is currently *not* a Moose-managed OlapTable — it was seeded via raw DDL — so you have two equally valid paths:

- Declare a Moose `MaterializedView` in `app/index.ts` that rolls `analytics.events` up by `(region, toDate(event_ts))` and rewrite the query (or add a small wrapper view) to read from it. Saving the file triggers Moose's reconciler.
- Use raw `clickhouse-client` to add a `PROJECTION`, change `ORDER BY` via `MODIFY ORDER BY`, or add a `MATERIALIZED VIEW` directly. (You may also bring `analytics.events` under Moose by declaring an `OlapTable` for it with `lifeCycle: "EXTERNALLY_MANAGED"` so Moose doesn't try to recreate it.)

Only the final state of `analytics.events` and the canonical query latency are scored — the path you took doesn't matter, but production gates flag temp/backup tables left behind in the `analytics` database.

- `clickhouse-client --user panda --password pandapass --query 'EXPLAIN indexes=1 ...'` to verify pruning.
- Tail `/workspace/moose-project/moose.log` to see the reconciler's output if you change Moose source.
- Document what you changed in `/workspace/README.md`.
