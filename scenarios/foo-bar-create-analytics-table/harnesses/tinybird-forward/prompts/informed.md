Set up a Tinybird data source for user activity events and load the sample CSV.

You have [Tinybird Forward](https://www.tinybird.co/docs/forward) (`tb` CLI) available. In Tinybird Forward, schema lives in `.datasource` files with `SCHEMA >`, `ENGINE`, and `ENGINE_SORTING_KEY` clauses. `tb --local deploy` applies changes; `tb --local datasource append <name> --file <path>` loads data.

State of play when you walk in:
- Pre-seeded empty Tinybird project at `/workspace/user-activity-project/` with just a bootstrap `_bootstrap.datasource` (key/value meta table, not part of the task — feel free to remove it).
- The Tinybird Local container is **stopped** but its named volume (`tinybird-data`) holds the workspace state. Start it with `docker start tb-local` — it'll rebind `localhost:7181` (Tinybird API) and `localhost:7182` (ClickHouse HTTP interface, read-only).
- Sample CSV at `/data/samples/user_activity_sample.csv` with columns: `event_id`, `event_ts`, `user_id`, `action`, `duration_ms`.

Build:
1. A `user_activity.datasource` file with a schema that captures the CSV fields. Name it `user_activity` so the data source ends up reachable as `${TB_WORKSPACE}.user_activity`.
2. Pick an `ENGINE_SORTING_KEY` that optimizes for the two intended query patterns:
   - Activity counts per user over a date range (filter by user + date range)
   - Total duration per action type (filter/group by action)
3. Deploy with `tb --local deploy`.
4. Append all rows from the CSV: `tb --local datasource append user_activity --file /data/samples/user_activity_sample.csv`. Nullable durations in the CSV (empty values) should land as 0 in the table — declare the column type accordingly.

Verify by running the two query shapes against `${TB_WORKSPACE}.user_activity` via the `:7182` ClickHouse interface (SELECT-only). Writes must go through `tb datasource append` or the Events API on `:7181` — `:7182` is read-only.
