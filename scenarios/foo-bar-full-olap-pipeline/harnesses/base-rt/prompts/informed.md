Build an end-to-end streaming analytics pipeline.

**Seed data**: 40 product interaction events (view, cart, purchase) as JSON files in `/data/events/`. Each event has: `event_id`, `event_ts` (ISO 8601), `user_id`, `product_id`, `event_type`, `properties` (JSON object; purchase events have `price`).

**Starting state**: ClickHouse and Redpanda are installed but not running. Start them before building the pipeline.

**Pipeline**:

1. **HTTP ingestion** (port 4000 or any port you pick): `POST /ingest/events` accepts JSON event bodies and forwards them to a Redpanda topic named `product-events`.
2. **Redpanda buffer**: The `product-events` topic persists events.
3. **ClickHouse landing**: A consumer reads from the topic and writes to `analytics.product_events` with columns: `event_id` String, `event_ts` DateTime, `user_id` String, `product_id` String, `event_type` String, `properties` String (raw JSON). Order by `(event_type, product_id, event_ts)`.
4. **Aggregations** (tables or materialized views):
   - `analytics.top_products`: `product_id`, `view_count`, `cart_count`, `purchase_count`, `revenue` (sum of price on purchases). Ordered by `purchase_count DESC`.
   - `analytics.conversion_funnel`: `step` (view/cart/purchase), `unique_users`, `total_events`. One row per step.
   - `analytics.hourly_activity`: `hour` (DateTime), `event_type`, `event_count`. Ordered by `hour`.
5. **Egress API** (port 3000): three endpoints, each responding under 200ms:
   - top-products → JSON array from `analytics.top_products` (limit 10)
   - funnel → JSON array from `analytics.conversion_funnel`
   - hourly → JSON array from `analytics.hourly_activity`

**Loading the seed data**: POST each of the 40 JSON files through your `/ingest/events` endpoint. Verify all 40 rows land in `analytics.product_events` and the aggregations reflect them.
