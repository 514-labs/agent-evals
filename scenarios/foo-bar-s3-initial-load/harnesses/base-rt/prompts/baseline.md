I have an initial-load export that looks like an S3 bucket prefix. The files and manifest are already on disk under `/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/`.

Please load the approved order files into a clean ClickHouse table and verify that the result matches the manifest. One file under the prefix is a replayed copy and should not create duplicate orders.

The final table should preserve order IDs, timestamps, customers, amounts, status, channel, country, promo code, and the source object for each loaded row.
