Use the Moose CLI and ClickHouse to implement the initial-load workflow from the S3-style prefix at `/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/`.

Use the environment variables for source configuration instead of hardcoding values:

- `S3_ENDPOINT=file:///data/s3`
- `S3_BUCKET=foo-bar-prod-exports`
- `S3_PREFIX=initial-load/orders/2026-01/`
- `S3_MANIFEST_PATH=/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/manifest.csv`

Create or initialize a Moose TypeScript project if needed, start `moose dev --dockerless`, and declare a typed destination OlapTable equivalent to `analytics.initial_load_orders` with these logical columns:

- `order_id` String
- `order_ts` DateTime or DateTime64
- `customer_id` String
- `amount_cents` integer
- `status` String or LowCardinality(String)
- `channel` String or LowCardinality(String)
- `country` String or LowCardinality(String)
- `promo_code` Nullable(String) or String
- `source_object` String

Choose the one-off initial-load path for this historical backfill. The prefix is partitioned hive-style under `dt=YYYY-MM-DD/hour=HH/` and contains 15 manifest-approved objects in mixed formats (CSV, gzipped CSV, JSONL, Parquet) plus replay copies under `archive/replayed/`. Load only manifest rows where `should_load=true`. Skip everything under `archive/replayed/`. One CSV is missing the `promo_code` column entirely — treat it as NULL.

Expected validation:

- 600,000 unique orders
- `sum(amount_cents) = 904799879`
- status counts are `paid=552070`, `refunded=30032`, `failed=17898`
- exactly 15 distinct `source_object` values (one per manifest-approved file)
- no duplicate `order_id`
- no rows with a `source_object` containing `archive/replayed`

Document how to rerun the load locally and what would need to be configured for a Boreal preview branch.
