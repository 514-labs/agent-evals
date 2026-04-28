Build an evolving analytics pipeline in three phases using MooseStack. Docs: https://docs.getmoose.dev/

A Moose project has already been scaffolded at `/workspace/moose-project`, and `moose dev --dockerless` is already running at `http://localhost:4000`. The default ClickHouse database is `analytics`. `cd` into the project — the dev server hot-reloads on file changes.

**Important:**
- Do NOT run `moose-tspc` or `moose build` manually — the dev server compiles automatically on file save. Check `moose.log` for errors.
- Do NOT restart or `pkill` the dev server. `moose ls` shows empty output until you save a valid `app/index.ts` — this is normal. After saving, wait a few seconds for hot-reload, then verify with `moose ls`.

**Phase 1 — Ingest and aggregate**

Postgres has `raw.events` (60 rows, columns: event_id, event_ts, user_id, event_type, product_id, amount). Define a Moose data model for events and load all 60 rows into ClickHouse. Create a materialized view or aggregation table for daily revenue per product (from purchase events only).

**Phase 2 — Schema evolution and backfill**

Postgres also has `raw.events_v2` (40 rows) with the same columns plus `region` (String) and `device` (String). Evolve your Moose data model to add `region` and `device` fields. Moose handles the ClickHouse schema migration. Then:

1. Load all 40 v2 rows with their actual region/device values.
2. Backfill the 60 existing rows with `region='unknown'` and `device='unknown'`.
3. Update the daily revenue aggregation to include `region` as a dimension.

After this phase, `analytics.events` should have exactly 100 rows, all with non-empty region values.

**Phase 3 — HTTP API**

Stand up an HTTP server on port 3000 (or add Moose API routes) with:

- `GET /api/revenue-by-region` → JSON array of `{ region, total_revenue }` objects, one per region, ordered by total_revenue DESC.
- `GET /api/top-products?limit=N` → JSON array of `{ product_id, total_revenue, purchase_count }` objects, ordered by total_revenue DESC, limited to N results (default 5).

Both endpoints must return valid JSON under 200ms.
