Change the ORDER BY of `analytics.events` from `(event_ts, event_id)` to `(event_type, event_ts, event_id)`. MergeTree does not allow ALTER TABLE … MODIFY ORDER BY for this kind of change, so:

1. Create a new table with the target ORDER BY.
2. Copy every row from the existing table into the new one.
3. Atomically replace the old table with the new one so downstream consumers see no gap.
4. Verify all 8 original rows are present and the ORDER BY is the new one.

Use only the ClickHouse CLI / HTTP interface. No extra tooling.
