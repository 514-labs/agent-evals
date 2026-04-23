Build an end-to-end analytics pipeline using Tinybird Forward: extract from Postgres, model in Tinybird, expose egress endpoints as Tinybird pipes.

You have [Tinybird Forward](https://www.tinybird.co/docs/forward) (`tb` CLI) available. In Tinybird Forward, schema lives in `.datasource` files, transformations in `.pipe` files. A `.pipe` with `TYPE materialized` writes to a target data source on every insert. A `.pipe` without `TYPE materialized` is an **endpoint pipe** — callable as `GET /v0/pipes/<pipe-name>.json?token=<admin-token>` on `:7181`.

State of play when you walk in:
- Pre-seeded empty Tinybird project at `/workspace/product-events-project/` with just a bootstrap `_bootstrap.datasource` (remove if you like).
- The Tinybird Local container is **stopped**. Start it with `docker start tb-local` (rebinds `localhost:7181` and `localhost:7182`).
- Postgres is supervised and seeded at `postgresql://postgres@localhost:5432/postgres` with table `raw.product_events(event_id TEXT, event_ts TIMESTAMPTZ, user_id TEXT, product_id TEXT, event_type TEXT, properties JSONB)`. Event types are `view`, `cart`, `purchase`. Revenue is in `properties->>'price'` on purchase events.

Tinybird Forward has **no native Postgres CDC**. You'll need to hand-roll the extract (e.g. `psql -t -A -F$'\t' ...` → NDJSON → `tb --local datasource append`, or post row-by-row to the Events API on `:7181`).

Build:
1. A `product_events.datasource` for the raw events (include the JSONB `properties` — declare as `String` and parse in pipes, or extract `price` as its own `Float64` column at ingest).
2. Three materialized `.pipe` files with target `.datasource` files (name them so `top`/`product`, `funnel`, and `hourly` appear in the target names — assertions discover them by fuzzy name match):
   - top products by purchase count + revenue sum
   - conversion funnel: views → carts → purchases with unique users and totals per step
   - hourly activity: event count per hour per event_type
3. Three **endpoint pipes** (no `TYPE materialized`) that return the aggregations. **Name them exactly `top_products`, `funnel`, and `hourly`** — the harness pre-configures `EGRESS_URL_TOP_PRODUCTS`, `EGRESS_URL_FUNNEL`, and `EGRESS_URL_HOURLY` to point at `http://localhost:7181/v0/pipes/<that-name>.json?token=${TB_ADMIN_TOKEN}`, so the API-contract assertions read your pipes directly. You do NOT need to stand up a separate HTTP server on `:3000`.

Writes go through `tb datasource append` or the Events API (`:7181`). The `:7182` ClickHouse interface is read-only.
