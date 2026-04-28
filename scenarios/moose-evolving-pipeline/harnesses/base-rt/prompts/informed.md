Build an evolving analytics pipeline in three phases. ClickHouse is installed but not running — start it with `clickhouse-server --daemon` or `clickhouse-server --config-file=/etc/clickhouse-server/config.xml &` before querying.

**Phase 1 — Ingest and aggregate**

Postgres has `raw.events` (60 rows, columns: event_id, event_ts, user_id, event_type, product_id, amount). Load all 60 rows into a ClickHouse table `analytics.events` with matching columns and appropriate types (event_ts as DateTime, amount as Float64). Create `analytics.daily_revenue` with columns `day` (Date), `product_id` (String), `total_revenue` (Float64), `event_count` (UInt64) — populated from purchase events (where `event_type = 'purchase'`).

**Phase 2 — Schema evolution and backfill**

Postgres also has `raw.events_v2` (40 rows) with the same columns as `raw.events` plus `region` (String) and `device` (String). Update `analytics.events`:

1. Add `region` (String, default `'unknown'`) and `device` (String, default `'unknown'`) columns.
2. Load all 40 v2 rows with their actual region/device values.
3. Backfill the 60 existing rows so they have `region='unknown'` and `device='unknown'`.
4. Rebuild `analytics.daily_revenue` to include `region` as a dimension (columns: day, region, product_id, total_revenue, event_count).

After this phase, `analytics.events` should have exactly 100 rows, all with non-empty region values.

**Phase 3 — HTTP API**

Stand up an HTTP server on port 3000 with:

- `GET /api/revenue-by-region` → JSON array of `{ region, total_revenue }` objects, one per region, ordered by total_revenue DESC. Sums all purchase amounts grouped by region.
- `GET /api/top-products?limit=N` → JSON array of `{ product_id, total_revenue, purchase_count }` objects, ordered by total_revenue DESC, limited to N results (default 5).

Both endpoints must query ClickHouse (use `CLICKHOUSE_URL` env var) and return valid JSON under 200ms.
