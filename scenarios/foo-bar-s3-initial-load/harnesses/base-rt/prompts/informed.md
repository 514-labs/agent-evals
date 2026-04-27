Load the S3-style source prefix at `/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/` into ClickHouse.

Use the environment variables for source configuration instead of hardcoding values:

- `S3_ENDPOINT=file:///data/s3`
- `S3_BUCKET=foo-bar-prod-exports`
- `S3_PREFIX=initial-load/orders/2026-01/`
- `S3_MANIFEST_PATH=/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/manifest.csv`

Create a typed ClickHouse table named `analytics.initial_load_orders` with these logical columns:

- `order_id` String
- `order_ts` DateTime or DateTime64
- `customer_id` String
- `amount_cents` integer
- `status` String or LowCardinality(String)
- `channel` String or LowCardinality(String)
- `country` String or LowCardinality(String)
- `promo_code` Nullable(String) or String
- `source_object` String

Load only manifest rows where `should_load=true`: `orders_2026_01.csv`, `orders_2026_02.csv`, and `orders_2026_03.jsonl`. Do not load `archive/replayed/orders_2026_02_copy.csv`.

Expected validation:

- 12 unique orders
- `sum(amount_cents) = 35284`
- status counts are `paid=10`, `refunded=1`, `failed=1`
- no duplicate `order_id`
- no rows with a `source_object` containing `archive/replayed`

Document how to rerun the load and how you verified the count against the manifest.
