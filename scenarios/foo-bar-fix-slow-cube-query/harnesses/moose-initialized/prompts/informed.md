The slow query in `/workspace/query.sql` is an OLAP cube-aggregation against `analytics.events` (30M rows, 6 months of data, 5 regions, 20 tag values, 5 priority levels, 6 event types including `deleted`). The table is `MergeTree() ORDER BY event_id`, deliberately uncorrelated with how this query filters and groups.

Make the canonical query in `/workspace/query.sql` run in under **100ms** (median of 5 cache-cold runs). The evaluator runs that exact query as-is, with `SYSTEM DROP QUERY CACHE; SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs **and** with `use_query_cache = 0` forced per-statement, so result-cache tricks do not move the needle — your job is to change the storage / indexing / aggregation layer so the query is genuinely fast end-to-end. Keep iterating until you actually hit the target; measure each iteration the way the evaluator will, and don't stop at the first attempt that "feels faster".

Environment:

- This harness is Moose-based. A Moose project is already scaffolded at `/workspace/moose-project` and **Moose is already running in `--dockerless` mode** in the background. `moose dev --dockerless` is the right mode for this container: it runs Moose against the native ClickHouse on the host network (no Docker-in-Docker) at HTTP `localhost:18123`, TCP `9000`, user `panda`, password `pandapass`, default DB `analytics`. If you ever need to restart Moose (e.g. after editing `moose.config.toml`), do it from `/workspace/moose-project` with `moose dev --dockerless`.
- Treat Moose as your primary path for managing schema and aggregation: declare `OlapTable`, `MaterializedView`, etc. in `app/index.ts` and let the reconciler apply them. Reach for raw `clickhouse-client` only when something is awkward to express in Moose.
- `analytics.events` was seeded via raw DDL — it is not currently a Moose-managed `OlapTable`. Only the final state of `analytics.events` and the canonical query latency are scored, so any combination of Moose primitives and raw DDL is acceptable.
- Use the `514--perf-optimize` skill (and `clickhouse--best-practices` when you need rule-level guidance). They are the canonical playbooks for this kind of work in a 514 / Moose project.

Constraints:

- The contents of `analytics.events` must remain identical: row count, `uniqExact(event_id)`, `sum(value)`, `sum(length(user_id))`, `sum(length(tags))`, and `sum(priority)` are all checked.
- The result rows of the canonical query must still match: integer columns exactly, float aggregates within ~3% relative (the `quantileTDigest` sketch tolerates that).
- Don't leave temp / backup tables in the `analytics` database.

Document what you tried, what worked, and what didn't in `/workspace/README.md`.
