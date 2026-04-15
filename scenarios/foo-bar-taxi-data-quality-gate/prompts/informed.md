Build an ingestion pipeline with quality gates for NYC taxi trip data.

## Data sources

Download the January 2024 NYC TLC taxi trip parquet files:
- Yellow taxi: https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet
- Green taxi: https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet

## Pipeline requirements

1. **Fetch** both parquet files.
2. **Validate** each row against these rejection rules:
   - `passenger_count` is NULL
   - `trip_distance` <= 0
   - `fare_amount` < 0 (negative fares)
   - `tpep_pickup_datetime` / `lpep_pickup_datetime` is in the future (after 2024-02-01)
3. **Load valid rows** into a ClickHouse table (e.g. `analytics.valid_trips`).
4. **Load rejected rows** into a separate ClickHouse table (e.g. `analytics.rejected_trips`) that includes a `rejection_reason` column (String) describing why each row was rejected.

A row that violates multiple rules should appear in the rejected table (it only needs one rejection_reason, though listing all is fine).

## Schema notes

- Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`. Normalize to common names.
- Add a `taxi_type` column (`'yellow'` or `'green'`).

## Idempotency

Re-running the pipeline should not create duplicates. Use TRUNCATE, DROP + CREATE, or another strategy.

## Output

Fill in `/workspace/assertions.json` with:
- `valid_table_name` — fully qualified name of the valid trips table
- `rejected_table_name` — fully qualified name of the rejected trips table
- `valid_count` — number of rows in the valid table
- `rejected_count` — number of rows in the rejected table
