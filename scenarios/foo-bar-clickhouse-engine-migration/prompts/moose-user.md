There is a Moose project at `/workspace/moose-project/` that models a ClickHouse table `analytics.events` (50,000 rows, populated — connection is in `$CLICKHOUSE_URL`). The project's `app/index.ts` currently defines the table as `MergeTree` with `ORDER BY (event_id)`.

Update the Moose project so that the `events` OlapTable uses `ReplacingMergeTree(updated_at)` with `ORDER BY (user_id, event_id)`. Generate and apply a migration that preserves all historical rows.

Hard requirements after applying the migration:

- `analytics.events` must have engine `ReplacingMergeTree(updated_at)` with `ORDER BY (user_id, event_id)`.
- `SELECT count() FROM analytics.events` must still return 50,000.
- `SELECT count() FROM analytics.events FINAL` must return 42,500.
- No leftover tables under `analytics` other than `events`, `_seed_meta`, and `_seed_spotchecks`.

Do **not** run `moose dev --dockerless`. ClickHouse is already running at `$CLICKHOUSE_URL`. Run `moose --help` to discover the subcommands available in the version of Moose installed in this harness and use them to generate and apply a migration against the external ClickHouse.
