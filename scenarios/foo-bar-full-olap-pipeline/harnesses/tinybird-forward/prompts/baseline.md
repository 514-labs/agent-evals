Build a real-time analytics pipeline for product interaction events.

There are 40 seed events as JSON files in `/data/events/`. The pipeline needs:

1. An HTTP endpoint that accepts event POSTs.
2. Events land in an analytics store.
3. Pre-aggregated views for:
   - Top products (view / cart / purchase counts and revenue from `properties.price` on purchases)
   - Conversion funnel (views → carts → purchases, with unique users and totals per step)
   - Hourly activity (event counts per hour per event type)
4. Three HTTP endpoints that return JSON for each of those aggregations, responding under 200ms.

Load all 40 seed events through the ingest endpoint and verify the aggregations reflect them.
