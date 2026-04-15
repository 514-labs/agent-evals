Build a complete analytics pipeline from scratch: ingest NYC taxi data, design a schema, create materialized views, and expose API endpoints.

## Data Sources

- Yellow taxi: `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet`
- Green taxi: `https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet`

## Schema Design

Create a unified analytics table with these key columns:
- `taxi_type` — `'yellow'` or `'green'`
- `pickup_datetime` — normalized from `tpep_pickup_datetime` (yellow) / `lpep_pickup_datetime` (green)
- `dropoff_datetime` — normalized similarly
- `passenger_count`, `trip_distance`, `fare_amount`, `total_amount`, `tip_amount`
- `PULocationID`, `DOLocationID`

Use `ORDER BY (taxi_type, pickup_datetime)`.

## Expected Row Counts

- Yellow: ~2,964,624 rows
- Green: ~85,046 rows
- Total: ~3,049,670 rows

## Materialized Views

Create at least 3 MVs:
1. **Daily stats** — trips, revenue, avg fare by day
2. **Taxi type summary** — trips, revenue, avg fare by taxi_type
3. **Fare distribution** — fare amount buckets with counts

## API Endpoints

Base URL: `http://localhost:3000`

1. `GET /stats` — Overall trip statistics (total trips, total revenue, avg fare)
2. `GET /fares` — Fare analysis (distribution, avg/min/max by taxi type)
3. `GET /trips` — Trip listing with `?taxi_type=` filter support and pagination

All endpoints should respond under 200ms on 3M+ rows (backed by MVs).

## Output

Fill in `/workspace/assertions.json`:
- `source_table`: the main analytics table name (e.g., `"analytics.trips"`)
- `mv_tables`: array of MV table names (e.g., `["analytics.daily_stats_mv", ...]`)
- `api_endpoints`: array of endpoint paths (e.g., `["/stats", "/fares", "/trips"]`)
- `total_ingested_rows`: total row count in the source table
