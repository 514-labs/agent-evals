Create materialized views over `analytics.taxi_trips` (~3M rows) to speed up common dashboard queries.

## Source table

`analytics.taxi_trips` has these columns:
- `taxi_type` (String) — always `'yellow'` for now
- `pickup_datetime` (DateTime)
- `dropoff_datetime` (DateTime)
- `passenger_count` (Nullable(Float64))
- `trip_distance` (Float64)
- `fare_amount` (Float64)
- `tip_amount` (Float64)
- `total_amount` (Float64)
- `payment_type` (Int64)
- `pu_location_id` (Int64)
- `do_location_id` (Int64)

The table uses `ORDER BY tuple()` (no ordering), which makes aggregation queries slow.

## Materialized views to create

### 1. Hourly trip counts
Target table (e.g. `analytics.mv_hourly_counts`):
- `pickup_hour` (DateTime) — truncated to hour
- `taxi_type` (String)
- `trip_count` (UInt64)

Ordered by `(pickup_hour, taxi_type)`.

### 2. Daily revenue by taxi type
Target table (e.g. `analytics.mv_daily_revenue`):
- `pickup_date` (Date)
- `taxi_type` (String)
- `trip_count` (UInt64)
- `total_fare` (Float64)
- `total_tips` (Float64)
- `total_amount` (Float64)

Ordered by `(pickup_date, taxi_type)`.

### 3. Fare distribution buckets
Target table (e.g. `analytics.mv_fare_buckets`):
- `fare_bucket` (String) — e.g. `'0-10'`, `'10-20'`, `'20-50'`, `'50-100'`, `'100+'`
- `trip_count` (UInt64)

Ordered by `(fare_bucket)`.

## Requirements

- All MVs must auto-populate when new rows are inserted into `analytics.taxi_trips`.
- Queries on MV target tables must return in under 50ms.
- The sum of hourly counts must match the total row count of the source table.
- The sum of fare bucket counts must match the total row count.
- Daily revenue for a specific date must match a direct query on the source.

## Output

Fill in `/workspace/assertions.json` with `mv_names` (array of MV names) and `target_table_names` (array of target table names).
