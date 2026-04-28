Build two materialized pipes in the pre-seeded Tinybird project so the existing `user_activity` data source feeds two dashboard access patterns.

You have [Tinybird Forward](https://www.tinybird.co/docs/forward) (`tb` CLI) available. Tinybird Forward treats schema as code: `.datasource` files declare tables, `.pipe` files declare transformations. A pipe with `TYPE materialized` writing to a `.datasource` target behaves like a ClickHouse materialized view — it auto-populates as new rows land in the source data source. Use `tb --local deploy --check` first to preview the plan; `tb --local deploy` applies it. Local-only operation works without `tb login`.

State of play when you walk in:
- Pre-seeded Tinybird project at `/workspace/user-activity-project` with an existing `user_activity` data source (columns: `event_id`, `event_ts`, `user_id`, `action`, `duration_ms Nullable(UInt32)`, 10 rows already loaded from `/data/samples/user_activity_sample.csv`).
- The Tinybird Local container is **stopped** but its named volume (`tinybird-data`) holds all seeded state. Start it with `docker start tb-local` — it'll rebind `localhost:7181` (Tinybird API) and `localhost:7182` (ClickHouse HTTP interface, read-only).
- Tinybird's ClickHouse interface on :7182 accepts SELECT/DESCRIBE only. DDL is handled by `tb deploy` against your `.datasource` / `.pipe` files.

Required outputs:
1. A **daily summary** materialized pipe + target data source — one row per (user_id, day) with event_count and total_duration (coalesce nulls to 0 so they don't pollute the sum). Name it so `daily` and `summary` both appear in the target data source name.
2. A **top users** materialized pipe + target data source — one row per user_id with all-time total_duration and event_count, so the dashboard can ORDER BY total_duration DESC. Name it so `top` and `user` both appear in the target data source name.

Prefer engines that naturally aggregate (`SummingMergeTree` or `AggregatingMergeTree`) for the target data sources — otherwise duplicates accumulate on re-materialization.

Don't drop or rename the existing `user_activity` data source — Tinybird's declarative model treats missing data sources as drops, so keep it declared in your project. All 10 seed rows must survive.

Leave a short README in `/workspace/` for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
