Fix the inconsistent metrics layer. Both Postgres (`raw.events`) and ClickHouse (`analytics.events`) have event data. The metric "daily_active_users" is defined differently in each:

- Postgres: count(distinct user_id) per day
- ClickHouse: currently uses count() or wrong logic

Align the definitions. Create `analytics.daily_metrics` in ClickHouse (or equivalent) with columns: day, dau (daily active users), revenue. Ensure the ClickHouse dau matches Postgres when computed over the same data. Use a single source of truth or identical formulas.
