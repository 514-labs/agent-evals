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

The prefix is partitioned hive-style under `dt=YYYY-MM-DD/hour=HH/` and contains 15 manifest-approved objects in mixed formats (CSV, gzipped CSV, JSONL, Parquet) plus replay copies under `archive/replayed/`. Load only manifest rows where `should_load=true`. Skip everything under `archive/replayed/`. One CSV is missing the `promo_code` column entirely — treat it as NULL.

Expected validation:

- 600,000 unique orders
- `sum(amount_cents) = 904799879`
- status counts are `paid=552070`, `refunded=30032`, `failed=17898`
- exactly 15 distinct `source_object` values (one per manifest-approved file)
- no duplicate `order_id`
- no rows with a `source_object` containing `archive/replayed`

Document how to rerun the load and how you verified the count against the manifest.

Definition of done: implement this end-to-end in a single pass without pausing to ask for confirmation. Treat the task as complete only when the destination table is populated and you have run queries against it that prove every validation criterion above. Do not stop after writing a plan, declaring the schema, or sketching a workflow skeleton with TODO comments — keep going until the data is loaded and verified, or until you hit a concrete blocker you cannot resolve from the codebase or environment.
