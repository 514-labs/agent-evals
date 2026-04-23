Build a full HTTP-in / HTTP-out analytics pipeline using Tinybird Forward.

You have [Tinybird Forward](https://www.tinybird.co/docs/forward) (`tb` CLI) available. Tinybird's architecture covers the ingest + buffer + egress layers natively:
- **HTTP ingest buffer**: the Events API on `:7181` accepts `POST /v0/events?name=<datasource>&wait=true` with JSON bodies. Tinybird buffers internally — you do not need Redpanda/Kafka.
- **Storage**: `.datasource` files (MergeTree under the hood, reachable via the `:7182` ClickHouse interface).
- **Materialization**: `.pipe` files with `TYPE materialized` write to target data sources on every insert.
- **Egress**: endpoint pipes (no `TYPE materialized`) are callable as `GET /v0/pipes/<pipe-name>.json?token=<admin>` on `:7181`.

State of play when you walk in:
- Pre-seeded empty Tinybird project at `/workspace/events-pipeline/` with just a bootstrap `_bootstrap.datasource` (remove if you like).
- The Tinybird Local container is **stopped**. Start it with `docker start tb-local` (rebinds `:7181` and `:7182`).
- 40 seed events at `/data/events/*.json` with fields: `event_id`, `event_ts`, `user_id`, `product_id`, `event_type` (`view` / `cart` / `purchase`), `properties` (JSON object; `price` present on purchases).

Build:
1. A **`product_events.datasource`** for the events. The name **must be `product_events`** — the harness's `INGEST_URL` env var is pre-configured to `http://localhost:7181/v0/events?name=product_events&wait=true`, and the `http_ingest_endpoint_exists` / `live_ingest_works` assertions post to that URL to verify ingest. Declare columns explicitly; for `properties` either keep it as `String` and parse in pipes, or extract `price` as its own `Float64` column at ingest.
2. Load all 40 events through the Events API. `for f in /data/events/*.json; do curl -X POST -H "Authorization: Bearer ${TB_ADMIN_TOKEN}" -d @"$f" "${INGEST_URL}"; done` is the simplest path (the harness exports `INGEST_URL` pointing at `/v0/events?name=product_events&wait=true`).
3. Three materialized `.pipe` files with target `.datasource` files (name the targets so `top`/`product`, `funnel`, and `hourly` appear — assertions discover them by fuzzy name match):
   - top products: per-product view/cart/purchase counts and revenue sum
   - funnel: views → carts → purchases with unique users and totals per step
   - hourly: event count per hour per event_type
4. Three **endpoint pipes** (no `TYPE materialized`) named **exactly `top_products`, `funnel`, `hourly`**. The harness pre-configures `EGRESS_URL_TOP_PRODUCTS`, `EGRESS_URL_FUNNEL`, and `EGRESS_URL_HOURLY` to point at `http://localhost:7181/v0/pipes/<name>.json?token=${TB_ADMIN_TOKEN}`, so the API-contract assertions hit your Tinybird pipes directly. **You do NOT need a separate HTTP server on `:3000`**.

Known scoring friction:
- A `redpanda_topic_exists` assertion checks for a Kafka-compatible buffer on `:9092`. Tinybird replaces that layer with its Events API — that assertion is expected to fail. The HTTP ingest, aggregation-correctness, and egress-endpoint assertions will all score on your Tinybird setup.

Writes go through `tb datasource append` or the Events API. The `:7182` ClickHouse interface is read-only.
