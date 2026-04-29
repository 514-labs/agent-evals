We have product interaction events (views, add-to-carts, purchases) in a Postgres table `raw.product_events`. I want to build this with Moose.

Set up a Moose project with `moose init --template typescript-empty` and run `moose dev --dockerless` to start the stack. Then:

1. Extract the events from Postgres and load them into ClickHouse through Moose
2. Create pre-aggregated views for: top products by purchase count with revenue, a conversion funnel (views → carts → purchases), and hourly activity breakdown
3. Stand up three egress JSON endpoints — top-products, funnel, and hourly activity — each returning JSON from the aggregated data.

Revenue comes from the `properties` JSONB column's `price` field on purchase events. Verify all three endpoints return valid JSON.
