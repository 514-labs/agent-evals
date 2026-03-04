Build a three-layer transformation pipeline from `raw.events` in Postgres to a daily mart in ClickHouse.

Layers:
1. **Staging** — Flatten the JSONB `payload` column into typed columns (session_id, event_type, user_id, value). Load into a ClickHouse staging table.
2. **Intermediate** — Sessionize the staged events: group by session_id, compute session duration, event count, and total value per session.
3. **Mart** — Aggregate to `analytics.daily_sessions`: one row per day with session_count, total_events, and total_revenue.

Handle null values in the JSON gracefully. The mart query should be fast enough for dashboard use (under 200ms).
