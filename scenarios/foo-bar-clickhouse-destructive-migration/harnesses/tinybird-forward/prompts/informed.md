Change the ORDER BY (aka `ENGINE_SORTING_KEY`) of the `events` data source from `event_ts, event_id` to `event_type, event_ts, event_id` so queries that filter by `event_type` hit the primary-key index. ClickHouse MergeTree does not allow `ALTER TABLE … MODIFY ORDER BY` for this kind of change — the migration is destructive: the table must be rebuilt with the new sorting key and every existing row backfilled.

You have [Tinybird Forward](https://www.tinybird.co/docs/forward) (`tb` CLI) available. Tinybird Forward treats schema as code: `.datasource` files declare the target state (`ENGINE`, `ENGINE_SORTING_KEY`, columns). When you run `tb --local deploy`, Tinybird's planner detects that a sorting-key change can't be done via ALTER and automatically creates a new table version, backfills all rows via an auto-generated forward query, and swaps it atomically. Use `tb --local deploy --check` first to preview the plan. Local-only operation works without `tb login` — the CLI manages a temporary local workspace.

State of play when you walk in:
- Pre-seeded Tinybird project at `/workspace/events-project` with the existing schema: `events` data source (`ENGINE_SORTING_KEY "event_ts, event_id"`, 10,000 rows already loaded) plus two anchor data sources `_seed_meta` and `_seed_spotchecks` used by verification.
- The Tinybird Local container is **stopped** but its named volume (in `$TB_VOLUME`) holds all seeded state. Start it with `docker start "$TB_CONTAINER"` — it'll rebind `localhost:7181` (Tinybird API) and `localhost:7182` (ClickHouse HTTP interface, read-only). `$TB_CONTAINER` and `$TB_VOLUME` are exported into your environment (per-run unique so concurrent runs don't collide).
- Tinybird's ClickHouse interface on :7182 accepts SELECT/DESCRIBE only. For writes use `tb datasource append --file`, `tb datasource append --events`, or `POST http://localhost:7181/v0/events?name=<ds>`. DDL is handled by `tb deploy` against your `.datasource` files.

All 10,000 original rows must survive. The anchor data sources `_seed_meta` and `_seed_spotchecks` must survive too — Tinybird's declarative model treats missing data sources as drops, so keep them declared in your project.

Leave a short README in `/workspace/` for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
