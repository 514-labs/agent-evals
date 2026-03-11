Build a multi-dimensional query API on port 3000.

Endpoint: `GET /api/metrics?date_from=2026-01-01&date_to=2026-01-31&region_id=1&product_id=2` (params optional). Return JSON with `total_value` (sum of value) and `event_count`. Use ClickHouse for `analytics.events` (ts, region_id, product_id, value). Use Postgres for `app.regions` and `app.products` if you need to resolve IDs to names. Support at least date range and one dimension filter. Choose the right store for each query type.
