A Moose project at `/workspace/moose-project` defines an `Orders` table sorted by `(customerId, orderTs)`. `moose dev --dockerless` is already running at `http://localhost:4000`, and the `Orders` table is populated with 3 million rows.

ClickHouse connection details live in `/workspace/moose-project/moose.config.toml` (`[clickhouse_config]` section: host, host_port, user, password, db_name) — `moose dev --dockerless` brings up its own ClickHouse on a non-default port with auth, so don't assume `localhost:8123`. A reference invocation also lives in the comment header of the planted query file at `/workspace/queries/top_orders_by_sku.sql`.

The query at `/workspace/queries/top_orders_by_sku.sql` filters by `productSku` and sorts by `orderTs DESC`. Because `productSku` is not a prefix of the table's `ORDER BY`, this query does a full scan today.

Add a ClickHouse projection through Moose's typed `OlapTable` config so the query is served from a projection sorted by `(productSku, orderTs)` without changing the table's primary `ORDER BY`. Specifically:

1. Edit the `OlapTable<Order>` definition in `/workspace/moose-project/app/index.ts` to add a `projections: [...]` entry. The projection body should sort by `productSku` first and `orderTs` second so the planted query matches the projection's ordering.
2. Save the file. `moose dev` hot-reloads on file changes: it issues `ALTER TABLE Orders ADD PROJECTION ...` and then `MATERIALIZE PROJECTION ... SETTINGS mutations_sync = 2`, so the 3M existing rows are backfilled synchronously before the reload returns. You don't need to issue `MATERIALIZE PROJECTION` yourself.
3. Verify the planted query runs at least 3x faster than before, and that `EXPLAIN indexes=1` for the query shows the projection is used.

Document the before/after timing and the projection definition in `/workspace/report.md`.

Reference: ClickHouse projection docs — https://clickhouse.com/docs/en/sql-reference/statements/alter/projection. Moose `TableProjection` shape: `{ name: string, body: string }` where `body` is `SELECT <columns> ORDER BY <key>`.
