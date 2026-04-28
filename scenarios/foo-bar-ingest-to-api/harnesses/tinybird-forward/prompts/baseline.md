We have product interaction events (views, add-to-carts, purchases) in a Postgres table `raw.product_events`. Build an analytics pipeline:

1. Get the events out of Postgres into an analytics data store.
2. Build pre-aggregated views for top products by purchase count with revenue, a conversion funnel (views → carts → purchases), and hourly activity breakdown.
3. Expose three HTTP endpoints — `/api/top-products`, `/api/funnel`, `/api/hourly` — that return JSON from those aggregations. They'll be called on port 3000.

Revenue comes from the `properties` JSONB column's `price` field on purchase events.
