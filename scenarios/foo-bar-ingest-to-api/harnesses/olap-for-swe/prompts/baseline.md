We have a Postgres table full of product interaction events — views, add-to-carts, and purchases. We need to get this data into ClickHouse and then set up a small API so our frontend team can pull insights.

The API should have three endpoints:
1. Top products by some metric
2. A conversion funnel (views → carts → purchases)
3. Activity over time

The event data is in `raw.product_events` in Postgres. Can you set the whole thing up?
