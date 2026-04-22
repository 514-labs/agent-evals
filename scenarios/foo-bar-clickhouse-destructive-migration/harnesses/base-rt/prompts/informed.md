Change the ORDER BY of `analytics.events` from `(event_ts, event_id)` to `(event_type, event_ts, event_id)`. ClickHouse MergeTree does not allow `ALTER TABLE … MODIFY ORDER BY` for this kind of change — the migration is destructive: rebuild the table with the new ORDER BY, backfill every row, and swap it in atomically so downstream consumers see no gap.

ClickHouse is NOT running — start the server yourself. All 10,000 original rows are on disk and must survive the migration. No DE toolkit is installed (dbt, Airflow, Spark); the ClickHouse CLI / HTTP interface is your path.

Leave a short README for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
