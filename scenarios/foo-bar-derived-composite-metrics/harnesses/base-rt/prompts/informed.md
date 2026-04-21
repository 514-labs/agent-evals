Build a derived metrics layer:

1. Source: analytics.events with columns event_ts, user_id, event_type (view/cart/purchase), amount (revenue on purchase).
2. Create analytics.metrics_daily with: day Date, conversion_rate Float64 (purchases/views), avg_order_value Float64, daily_active_users UInt64.
3. conversion_rate = count(purchase) / nullIf(count(view), 0). avg_order_value = sum(amount where purchase) / nullIf(count(purchase), 0).
4. Populate from analytics.events. Use a materialized view or ETL.
