Migrate the ClickHouse table `analytics.events` from `MergeTree` with `ORDER BY (event_id)` to `ReplacingMergeTree(updated_at)` with `ORDER BY (user_id, event_id)`.

Hard requirements:

- Preserve all 50,000 historical rows.
- `SELECT count() FROM analytics.events FINAL` must return the unique-key count (42,500) after the migration.
- For any duplicated `(user_id, event_id)`, `SELECT … FINAL` must return the row with the latest `updated_at`.
- Clean up any temporary tables you create — the only tables under `analytics` should be `events`, `_seed_meta`, and `_seed_spotchecks` when you finish.

ClickHouse is running. Use `clickhouse-client --url "$CLICKHOUSE_URL" --query '…'` to connect.
