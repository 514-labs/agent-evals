Evolve the schema of `analytics.taxi_trips_v1` to support the newer data format, backfill existing rows, and ingest the February 2024 data.

## Current state

- `analytics.taxi_trips_v1` contains January 2024 yellow taxi data (~3M rows)
- The table is **missing** two columns that exist in newer parquet files:
  - `congestion_surcharge` (should be `Float64`)
  - `airport_fee` (should be `Float64`)
- `payment_type` is currently stored as `Int32` but should be `String` for the new format

## What to do

1. **Add missing columns** — Add `congestion_surcharge Float64` and `airport_fee Float64` to the table (or create a new table with the correct schema and migrate data).
2. **Convert payment_type** — Change `payment_type` from `Int32` to `String`. ClickHouse doesn't support ALTER COLUMN type changes on MergeTree easily, so you may need to create a new table and migrate.
3. **Backfill defaults** — For existing January rows, set `congestion_surcharge = 0` and `airport_fee = 0`. Convert `payment_type` integer values to their string representations (e.g., `1` → `'1'` or a descriptive mapping).
4. **Ingest new data** — Load `/data/taxi/yellow_tripdata_2024-02.parquet` into the migrated table. This file has the full schema including `congestion_surcharge` and `airport_fee`.

## Expected outcome

- A single table with both January and February data (~6M total rows)
- All rows have `congestion_surcharge` and `airport_fee` columns (Jan rows default to 0)
- `payment_type` is `String` type (check via `system.columns`)
- No data loss — the `fare_amount` sum for January rows should match the pre-migration value

## Output

Fill in `/workspace/assertions.json` with:
- `migrated_table_name`: fully qualified table name (e.g., `analytics.taxi_trips_v2`)
- `new_columns`: array of added column names (e.g., `["congestion_surcharge", "airport_fee"]`)
- `total_rows_after_migration`: total row count after both months are loaded
