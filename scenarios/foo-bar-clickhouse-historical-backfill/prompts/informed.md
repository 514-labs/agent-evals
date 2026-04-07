Fix the historical backfill from `staging.historical_events` to `analytics.events`.

The target table has a naive layout (no partition or wrong ORDER BY) that causes slow inserts. Optimize the target table with appropriate PARTITION BY toDate(event_ts) and ORDER BY (event_ts, event_id). Ensure the backfill completes and all rows from staging are present in analytics.events.
