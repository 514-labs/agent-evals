Target shape for `analytics.events`:
- Existing columns preserved: `event_id` (String), `event_ts` (DateTime), `event_type` (String), `user_id` (String)
- New column: `session_id` (String)
- Every existing row must have `session_id` populated as `concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))` — verified byte-for-byte by assertions
- Queries that filter by `session_id` should hit the primary-key index

State when you walk in:
- Primary ClickHouse is NOT running. Data lives on disk at `/var/lib/clickhouse`.
- `analytics.events` currently has 10,000 rows and NO `session_id` column. All rows must survive.
- Anchor tables `analytics._seed_meta` and `analytics._seed_spotchecks` must not be dropped or mutated.
- You have the [Atlas](https://atlasgo.io/) CLI (already logged in via a bind-mounted `~/.atlas/`). A second empty ClickHouse for Atlas's `--dev-url` is already running on `localhost:9001` (HTTP on `localhost:8124`) with an empty `_atlas_dev` database; the full connection URL is in `$CLICKHOUSE_DEV_URL`.

Leave a short README in `/workspace/` for the on-call operator (what you did and how to verify), and keep your steps safe to re-run.
