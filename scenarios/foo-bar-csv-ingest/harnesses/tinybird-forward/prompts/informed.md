Clean and load five messy CSV files into a Tinybird data source.

You have [Tinybird Forward](https://www.tinybird.co/docs/forward) (`tb` CLI) available. Schema lives in `.datasource` files. `tb --local deploy` applies; `tb --local datasource append <name> --file <path>` loads data.

State of play when you walk in:
- Pre-seeded empty Tinybird project at `/workspace/events-project/` with just a `_bootstrap.datasource` (meta table, not part of the task — remove it if you like).
- The Tinybird Local container is **stopped**. Start it with `docker start tb-local`. It'll rebind `localhost:7181` (Tinybird API) and `localhost:7182` (ClickHouse HTTP interface, read-only).
- Five CSV files at `/data/csv/` with known data-quality issues:
  - Inconsistent date formats (`YYYY-MM-DDTHH:MM:SSZ` vs `DD/MM/YYYY`)
  - Mixed null representations (`""`, `N/A`, `null`, missing trailing field)
  - A duplicate header row in one file
  - Trailing commas producing an extra blank column in another
- Total **15** well-formed rows are expected after cleaning. Duplicates and bad dates must not survive.

Build:
1. An `events.datasource` file with schema: `event_id String, event_ts DateTime, user_id String, event_type String, value Float64`. Pick an `ENGINE_SORTING_KEY` appropriate for this event data (`event_ts, event_id` is fine).
2. Nulls in the `value` column must land as `0.0`, not NULL. Declare the column non-nullable and coerce during cleaning, or use a staging data source + materialized pipe with `coalesce(value, 0)`.
3. Pre-process the CSVs however you like (shell, Python, a staging `.datasource` + pipe) to normalize dates, strip extra headers, drop trailing delimiters, and coerce nulls.
4. `tb --local deploy` then append the cleaned rows via `tb --local datasource append events --file <path>`. The Events API on `:7181` (`POST /v0/events?name=events&wait=true`) is an alternative for row-at-a-time JSON ingest.

Verify exactly 15 rows land in the `events` data source with no duplicates and all valid DateTime values in `event_ts`.
