Fix the failed metric definition backfill. Source: `raw.events` in Postgres (event_ts, user_id, value). Target: `analytics.metric_daily` in ClickHouse (day, user_count, total_value).

The backfill partially ran and left duplicates or gaps. Truncate and re-backfill idempotently, or deduplicate and backfill only missing dates. Ensure the final row count and sum(total_value) match the source. The backfill must be safe to re-run (idempotent).
