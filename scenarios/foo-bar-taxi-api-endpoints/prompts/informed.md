Design an analytics schema from raw NYC taxi trip data and build an HTTP API on port 3000.

## Starting state

ClickHouse has two raw staging tables:
- `raw.yellow_trips_2024_01` — ~3M rows of yellow taxi trip data
- `raw.green_trips_2024_01` — ~80K rows of green taxi trip data

Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`. Add a `taxi_type` column (`'yellow'` or `'green'`) to unify them.

## Analytics schema

Create a unified analytics table (e.g. `analytics.taxi_trips`) with appropriate column types and ORDER BY for efficient time-range and taxi-type filtering. Transform and load data from both raw tables.

## API endpoints

Stand up an HTTP server on port 3000 with these three endpoints:

### 1. `GET /api/trips`
List trips with pagination. Accept query params:
- `page` (default 1) and `page_size` (default 20, max 100)
- Optional filters: `taxi_type`, `start_date`, `end_date`

Returns a JSON object: `{ "data": [...], "total": <number>, "page": <number>, "page_size": <number> }`

### 2. `GET /api/fare-summary`
Aggregate fare statistics. Accept optional `taxi_type` filter. Returns:
```json
{
  "total_trips": <number>,
  "total_fare": <number>,
  "avg_fare": <number>,
  "min_fare": <number>,
  "max_fare": <number>
}
```

### 3. `GET /api/top-trips`
Return the top trips by fare amount. Accept `limit` (default 10, max 100) and optional `taxi_type` filter. Returns a JSON array of trip objects sorted by fare descending.

## Requirements

- All endpoints must handle ~3M rows efficiently — pagination is required for the trips list.
- Each endpoint should respond in under 500ms.
- Return proper HTTP status codes: 400 for invalid params, not 500.

## Output

Fill in `/workspace/assertions.json` with `analytics_table_name`, `api_base_url`, and the `endpoints` array describing each endpoint path.
