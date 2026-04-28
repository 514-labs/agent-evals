We have product interaction events in Postgres that need to flow into ClickHouse for analytics. There are actually two tables in Postgres — an older batch in `raw.events` and a newer batch in `raw.events_v2`. The newer batch has two extra columns the older one doesn't: region and device.

I need three things done:

1. Get all the events into a single ClickHouse table and build a daily revenue breakdown by product.
2. The newer events have region and device info. The older ones don't — backfill them with `'unknown'` so every row has a value. Update the daily breakdown to include region as a dimension.
3. Stand up an HTTP API on port 3000 with two endpoints: one that shows revenue grouped by region, and one that returns top products ranked by total revenue.
