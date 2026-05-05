An `Orders` table lives in ClickHouse at `local.Orders`, sorted by `(customerId, orderTs)` and populated with 3 million rows. ClickHouse is running on `http://localhost:8123` (no auth) — `clickhouse-client --host localhost --port 9000 --database local` works for the native protocol, or use `curl --data-binary @file 'http://localhost:8123/?database=local'` over HTTP.

The query at `/workspace/queries/top_orders_by_sku.sql` filters by `productSku` and sorts by `orderTs DESC`. Because `productSku` is not a prefix of the table's `ORDER BY`, this query does a full scan today.

Add a ClickHouse projection so the query is served from a projection sorted by `(productSku, orderTs)` without changing the table's primary `ORDER BY`. Specifically:

1. Run `ALTER TABLE local.Orders ADD PROJECTION <name> (SELECT <columns covering the planted query> ORDER BY (productSku, orderTs))`. The projection body should sort by `productSku` first and `orderTs` second so the planted query matches the projection's ordering.
2. Run `ALTER TABLE local.Orders MATERIALIZE PROJECTION <name>` to backfill the projection over the 3M existing rows. `ADD PROJECTION` alone only covers *new* parts.
3. Verify the planted query runs at least 3x faster than before, and that `EXPLAIN indexes=1` for the query shows the projection is used (look for `ReadFromMergeTree (<projection_name>)` in the plan).

Document the before/after timing and the projection definition in `/workspace/report.md`.

Reference: ClickHouse projection docs — https://clickhouse.com/docs/en/sql-reference/statements/alter/projection.
