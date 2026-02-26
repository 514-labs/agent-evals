Build a deterministic Postgres-to-ClickHouse pipeline for daily orders reporting.

Requirements:
- Source is `raw.orders` in Postgres.
- Create `analytics.fct_orders_daily` in ClickHouse.
- Deduplicate by `order_id`.
- Aggregate to one row per `order_day`.
- Include `order_count` and `daily_revenue`.
- The process must be idempotent across reruns.
