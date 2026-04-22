Load sample event data from /data/samples/user_activity_sample.csv into a ClickHouse base table, then create two materialized views:

1. **daily_summary**: Aggregates per user per day — columns: `day` (Date), `user_id` (String), `event_count` (UInt64), `total_duration_ms` (Float64). Should use `SummingMergeTree` or `AggregatingMergeTree` ordered by `(day, user_id)`.

2. **top_users**: All-time leaderboard — columns: `user_id` (String), `total_duration_ms` (Float64), `event_count` (UInt64). Should use `SummingMergeTree` ordered by `user_id`.

Both MVs should automatically populate when new rows are inserted into the base table. Nullable duration values should default to 0.

Verify by inserting the sample data, then querying both views to confirm they return correct aggregates.
