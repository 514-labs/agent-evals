Change the ORDER BY of `analytics.events` from `(event_ts, event_id)` to `(event_type, event_ts, event_id)`. MergeTree does not allow ALTER TABLE … MODIFY ORDER BY for this kind of change, so the migration is destructive (create new, backfill, swap).

You have dbt and dbt-clickhouse available. You may also use the ClickHouse CLI directly — use whichever makes the swap+backfill cleanest. Verify all 8 original rows are present and the new ORDER BY is applied.
