Create a ClickHouse table `analytics.user_activity` to store user activity events. A sample of the data is in `/data/samples/user_activity_sample.csv` — use it to determine column types.

The table needs to efficiently support two query patterns:
1. **Activity counts per user over a date range**: `SELECT user_id, count() FROM analytics.user_activity WHERE event_ts BETWEEN '2026-01-15' AND '2026-01-16' GROUP BY user_id`
2. **Total duration per action type**: `SELECT action, sum(duration_ms) FROM analytics.user_activity GROUP BY action`

Choose an appropriate ORDER BY key that makes both patterns fast. Nullable duration values should default to 0.

Verify by loading the sample data and running both queries.

Use MooseStack skills, framework and MCP.
