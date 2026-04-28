Target shape for `analytics.events`:
- Existing columns preserved: `event_id` (String), `event_ts` (DateTime), `event_type` (String), `user_id` (String)
- New column: `session_id` (String)
- Every existing row must have `session_id` populated as `concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))` — this is the rule the analytics team has committed to, verified byte-for-byte by assertions
- Queries that filter by `session_id` should hit the primary-key index

State when you walk in:
- ClickHouse is NOT running. Data lives on disk at `/var/lib/clickhouse`.
- `analytics.events` currently has 10,000 rows and NO `session_id` column. All rows must survive.
- Anchor tables `analytics._seed_meta` and `analytics._seed_spotchecks` also live in this database; they must not be dropped or mutated.
- No DE toolkit is installed (dbt, Airflow, Spark). The ClickHouse CLI and HTTP interface are what you have.

Leave a short README in `/workspace/` for the on-call operator (what you did and how to verify), and keep your steps safe to re-run.
