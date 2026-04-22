I want to build a full analytics pipeline through Moose. There are 40 product interaction events in `/data/events/` as JSON files (fields: `event_id`, `event_ts`, `user_id`, `product_id`, `event_type`, `properties`).

Set up a Moose project with `moose init --template typescript-empty` and run `moose dev --dockerless` to start the stack. Then:

1. Define a data model for product events and expose an ingest endpoint so clients can POST new events
2. Let Moose route events through its stream buffer into ClickHouse
3. Create pre-aggregated views for:
   - Top products (view/cart/purchase counts and revenue from `properties.price` on purchases)
   - Conversion funnel (views → carts → purchases, with unique users and totals per step)
   - Hourly activity (event counts per hour per event type)
4. Stand up egress API endpoints returning JSON for each of those three aggregations, responding under 200ms

Load all 40 seed events through your ingest endpoint and verify they land in ClickHouse and flow through to the aggregations.
