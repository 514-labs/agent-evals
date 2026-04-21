Create a ClickHouse table with TTL for data lifecycle:

1. Create table `analytics.raw_events` with columns: event_id String, event_ts DateTime, payload String.
2. Add a TTL expression so that rows are dropped when `event_ts` is older than 90 days: `TTL event_ts + INTERVAL 90 DAY`.
3. Use MergeTree engine with ORDER BY (event_ts, event_id).
4. Optionally add a PARTITION BY toMonth(event_ts) for efficient TTL application.
