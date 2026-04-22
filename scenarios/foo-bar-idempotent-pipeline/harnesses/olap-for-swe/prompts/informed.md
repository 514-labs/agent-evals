Build an idempotent pipeline from `raw.orders` in Postgres to `analytics.orders` in ClickHouse.

Requirements:
- The ClickHouse target should use ReplacingMergeTree (or equivalent deduplication strategy) keyed on `order_id` with `updated_at` as the version column.
- Running the pipeline multiple times must produce the same result as running it once.
- If a row in Postgres is updated (same order_id, newer updated_at), the ClickHouse table should reflect the latest version.
- Queries against the target should use FINAL or an equivalent mechanism to return deduplicated results.
- Point lookups by order_id should be fast (under 100ms).
