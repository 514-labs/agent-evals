Build an end-to-end ingest-to-API pipeline:

**Step 1 — Ingest**: Extract from `raw.product_events` in Postgres (columns: event_id, event_ts, user_id, product_id, event_type, properties JSONB). Load into a ClickHouse table `analytics.product_events` with appropriate types and ORDER BY (event_type, product_id, event_ts).

**Step 2 — Aggregations**: Create three pre-aggregated tables or materialized views in ClickHouse:
- `analytics.top_products` — product_id, view_count, cart_count, purchase_count, revenue. Ordered by purchase_count DESC.
- `analytics.conversion_funnel` — step (view/cart/purchase), unique_users, total_events. One row per step.
- `analytics.hourly_activity` — hour (DateTime), event_type, event_count. Ordered by hour.

Revenue comes from `properties->>'price'` on purchase events (cast to Float64, default 0).

**Step 3 — API**: Stand up an HTTP server on port 3000 (Node.js, Python, or any language) with:
- `GET /api/top-products` → JSON array from `analytics.top_products` (limit 10)
- `GET /api/funnel` → JSON array from `analytics.conversion_funnel`
- `GET /api/hourly` → JSON array from `analytics.hourly_activity`

Each endpoint must query ClickHouse and return valid JSON. Responses should complete under 200ms.
