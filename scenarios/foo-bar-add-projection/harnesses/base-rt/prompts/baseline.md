There's an `Orders` table in ClickHouse (database `local`) populated with 3 million rows. ClickHouse is running on `http://localhost:8123` (no auth).

There's a query at `/workspace/queries/top_orders_by_sku.sql` that the team uses on a customer-facing dashboard. It is too slow.

Investigate why it is slow and make it run at least 3x faster against the existing data. Don't change what the query returns or break the customer-history access pattern that the table is currently optimized for.

Write a short summary of what you changed and the before/after performance to `/workspace/report.md`.
