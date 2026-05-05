A Moose project at `/workspace/moose-project` defines an `Orders` table that mirrors an OLTP orders feed into ClickHouse. `moose dev --dockerless` is already running at `http://localhost:4000`, and the `Orders` table is populated with 3 million rows.

There's a query at `/workspace/queries/top_orders_by_sku.sql` that the team uses on a customer-facing dashboard. It is too slow.

Investigate why it is slow and make it run at least 3x faster against the existing data. Don't change what the query returns or break the customer-history access pattern that the table is currently optimized for.

Write a short summary of what you changed and the before/after performance to `/workspace/report.md`.
