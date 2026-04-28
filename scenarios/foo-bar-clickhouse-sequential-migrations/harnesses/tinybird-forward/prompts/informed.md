A pre-seeded Tinybird project lives at `/workspace/events-project`. The `events` data source currently declares `event_id`, `event_ts`, `event_type`, `user_id` with `ENGINE_SORTING_KEY "event_ts, event_id"`. 10,000 rows are loaded. Two anchor data sources (`_seed_meta`, `_seed_spotchecks`) also live in the project.

The Tinybird Local container is **stopped** but its named volume (in `$TB_VOLUME`) holds all seeded state. Start it with `docker start "$TB_CONTAINER"` — it'll rebind `localhost:7181` (Tinybird API) and `localhost:7182` (ClickHouse HTTP interface, read-only). `$TB_CONTAINER` and `$TB_VOLUME` are exported into your environment (per-run unique so concurrent runs don't collide).

Target shape for the `events` data source:
- Existing columns preserved: `event_id` (String), `event_ts` (DateTime), `event_type` (String), `user_id` (String)
- New column: `session_id` (String)
- Every existing row must have `session_id` populated as `concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))` — verified byte-for-byte by assertions
- Queries that filter by `session_id` should hit the primary-key index

All 10,000 rows must survive. The anchor data sources `_seed_meta` and `_seed_spotchecks` must not be dropped or mutated.

You have the [Tinybird Forward](https://www.tinybird.co/docs/forward) `tb` CLI. `--local` operations do not require `tb login`.

Leave a short README in `/workspace/` for the on-call operator (what you did and how to verify), and keep your steps safe to re-run.
