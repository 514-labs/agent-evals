Raw NYC taxi trip data is pre-loaded in ClickHouse:
- `raw.yellow_trips_2024_01` -- ~3M rows of yellow taxi trips
- `raw.green_trips_2024_01` -- ~85K rows of green taxi trips

## Schema differences

- Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`.
- Green has an extra `trip_type` column.
- Unify into a single analytics table with a `taxi_type` discriminator column.

## Analytics schema

Design a clean analytics table with:
- Unified `pickup_datetime` / `dropoff_datetime` columns
- A `taxi_type` column (`'yellow'` or `'green'`)
- Proper ORDER BY for time-range and taxi-type queries, e.g. `ORDER BY (taxi_type, pickup_datetime)`
- Consider PARTITION BY `toYYYYMM(pickup_datetime)` for future scalability

## Metrics to define

Define at least these four semantic metrics:
1. **avg_fare** -- average `fare_amount` across trips
2. **total_revenue** -- sum of `total_amount`
3. **trips_per_day** -- count of trips grouped by date
4. **avg_distance** -- average `trip_distance`

Store metric definitions in a YAML or JSON config file so they are declarative and inspectable.

## API endpoints

Expose at least these endpoints:
- `GET /metrics` -- list available metrics
- `GET /metrics/{metric_name}` -- compute and return a metric value
- `GET /metrics/{metric_name}?taxi_type=yellow&start_date=2024-01-01&end_date=2024-01-31` -- filtered metric

Expected response shape:
```json
{
  "metric": "total_revenue",
  "value": 73857362.21,
  "filters": {"taxi_type": "yellow", "start_date": "2024-01-01", "end_date": "2024-01-31"}
}
```

Invalid filters should return HTTP 400 with an error message, not a 500 error.

Consider using materialized views or pre-aggregated rollup tables to keep endpoint latency under 100ms.

## Output

Fill in `/workspace/assertions.json` with `analytics_table_name`, `metric_names` (array), `definition_file` (path to metric definitions), `api_base_url`, and `endpoints` (array of endpoint paths).
