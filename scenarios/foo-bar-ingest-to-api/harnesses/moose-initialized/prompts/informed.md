We have product interaction events (views, add-to-carts, purchases) in a Postgres table `raw.product_events`. I want to build this with Moose.

A Moose project has already been scaffolded at `/workspace/moose-project`, and `moose dev --dockerless` is already running at `http://localhost:4000`. `cd` into the project — the dev server hot-reloads on file changes. Then:

1. Extract the events from Postgres and load them into ClickHouse through Moose
2. Create pre-aggregated views for: top products by purchase count with revenue, a conversion funnel (views → carts → purchases), and hourly activity breakdown
3. Stand up three egress JSON endpoints — top-products, funnel, and hourly activity — each returning JSON from the aggregated data.

Revenue comes from the `properties` JSONB column's `price` field on purchase events. Verify all three endpoints return valid JSON.
