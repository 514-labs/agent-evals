The slow query in `/workspace/query.sql` is an OLAP cube-aggregation: monthly rollup of `region × tag × priority` over `analytics.events` (30M rows, 6 months of data, 5 regions, 20 tag values, 5 priority levels) computing `count`, `avg(value)`, `quantileTDigest(0.5)`, `quantileTDigest(0.9)`, `uniqExact(user_id)`, plus a `COUNT() OVER ()` window total. Several things compound to make it slow:

- The table is `MergeTree() ORDER BY event_id`, which prunes nothing for the `event_ts` filter.
- `arrayJoin(tags)` triples the rows the GROUP BY sees (each event has 3 tags from a pool of 20).
- `quantileTDigest(0.5)(value)` and `quantileTDigest(0.9)(value)` each maintain sketch state over every row — they can't be cheaply approximated.
- `event_type != 'deleted'` is a string filter on a non-prefix column.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, `sum(length(user_id))`, `sum(length(tags))`, and `sum(priority)` must remain identical after your fix. The result rows of the canonical query must also match (integer columns exactly, `avg_value` / `p50` / `p90` within ~0.1% relative tolerance).

The container has Moose installed and a scaffolded project at `/workspace/moose-project`, with `moose dev --dockerless` already running in the background against the same ClickHouse instance (HTTP `localhost:18123`, TCP `9000`, user `panda`, password `pandapass`, default DB `analytics`). `analytics.events` is currently *not* a Moose-managed `OlapTable` — it was seeded via raw DDL — so you have two equally valid paths:

- Declare a Moose `MaterializedView` in `app/index.ts` backed by an `AggregatingMergeTree` rolling up by `(toStartOfMonth(event_ts), region, tag, priority)` with `countState`, `avgState(value)`, `quantileTDigestState(0.5)(value)`, `quantileTDigestState(0.9)(value)`, `uniqExactState(user_id)`. Saving the file triggers Moose's reconciler. Update the canonical query (or add a thin wrapper view) to read from the rollup using `Merge` finalizers.
- Use raw `clickhouse-client` to add the same materialized view directly, add a `PROJECTION` with the cube shape, or change `ORDER BY` via `MODIFY ORDER BY`. (You may also bring `analytics.events` under Moose by declaring an `OlapTable` for it with `lifeCycle: "EXTERNALLY_MANAGED"` so Moose doesn't try to recreate it.)

Only the final state of `analytics.events` and the canonical query latency are scored — the path you took doesn't matter, but production gates flag temp/backup tables left behind in the `analytics` database.

- `clickhouse-client --user panda --password pandapass --query 'EXPLAIN indexes=1 ...'` to verify pruning.
- Tail `/workspace/moose-project/moose.log` to see the reconciler's output if you change Moose source.
- Document what you changed in `/workspace/README.md`.
