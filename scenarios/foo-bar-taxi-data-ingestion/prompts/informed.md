Download the January 2024 NYC TLC taxi trip parquet files and load them into ClickHouse.

## Data sources

- Yellow taxi: https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet
- Green taxi: https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet

## Schema notes

The two files share most columns but have key differences:
- Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`.
- Green has an extra `trip_type` column not present in yellow.
- Add a `taxi_type` column (`'yellow'` or `'green'`) so both datasets can live in a single table.

## Known data quality issues

- `passenger_count` is frequently NULL -- default to 1 or filter.
- Some rows have `trip_distance = 0` (zero-distance trips) -- decide whether to keep or exclude.
- `fare_amount` and `total_amount` can be negative -- exclude or flag these rows.

## Recommended ORDER BY

Consider `ORDER BY (taxi_type, tpep_pickup_datetime)` (rename to a common `pickup_datetime`) for efficient time-range and taxi-type filtering.

## Output

Create the database and table, load the data, then fill in `/workspace/assertions.json` with the chosen `table_name`, `database_name`, and `total_row_count`.
