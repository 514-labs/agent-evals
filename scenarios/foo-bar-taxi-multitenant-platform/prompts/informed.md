Build a multi-tenant analytics platform for NYC taxi trip data on ClickHouse.

## Data ingestion

Fetch yellow and green taxi trip parquet files for January and February 2024 from the NYC TLC data source:

- `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet`
- `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-02.parquet`
- `https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet`
- `https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-02.parquet`

Expected totals: ~6M rows across both months and both taxi types. Yellow January has ~2.96M rows, yellow February ~3M rows; green January ~85K, green February ~80K.

Load these into a `raw` database first, then transform into a unified analytics table.

## Schema design

- Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`.
- Green has an extra `trip_type` column.
- Unify into a single analytics table (e.g., `analytics.trips`) with:
  - A `taxi_type` column (`'yellow'` or `'green'`)
  - Unified `pickup_datetime` / `dropoff_datetime` columns
  - `ORDER BY (taxi_type, pickup_datetime)` for efficient tenant + time-range queries
  - `PARTITION BY toYYYYMM(pickup_datetime)` for scalability
- Create a daily metrics materialized view or rollup table (e.g., `analytics.daily_metrics`) pre-aggregated by `taxi_type` and `pickup_date`.

## Semantic metrics layer

Define at least these metrics in a declarative config file (YAML or JSON):
1. **avg_fare** -- average `fare_amount`
2. **total_revenue** -- sum of `total_amount`
3. **trips_per_day** -- count of trips grouped by date
4. **avg_distance** -- average `trip_distance`

## API endpoints

Build an HTTP API server (port 3000) with at least these endpoints:
- `GET /api/trips` -- paginated trip listing, filtered by taxi_type from JWT
- `GET /api/metrics/:name` -- compute and return a named metric, scoped to the tenant's taxi type
- `GET /api/summary` -- dashboard summary with total trips, revenue, and average fare for the tenant

All endpoints must require a valid JWT in the `Authorization: Bearer <token>` header.

Expected response shapes:
```json
{"metric": "total_revenue", "value": 73857362.21, "filters": {"taxi_type": "yellow"}}
```
```json
{"trips": [...], "page": 1, "page_size": 100, "total": 2964624}
```

Unauthenticated requests must return HTTP 401. Invalid filters should return HTTP 400.

## JWT authentication

Auth materials are pre-staged in `/data/auth/`:
- `jwt-secret.txt` -- the HMAC signing secret
- `yellow-tenant.jwt` -- a pre-signed token with `{"tenant": "yellow"}` claim
- `green-tenant.jwt` -- a pre-signed token with `{"tenant": "green"}` claim

Read the JWT secret from the file. Verify tokens using HS256. Extract the `tenant` claim to scope all queries to that taxi type.

A request with the yellow tenant JWT must only see yellow cab data. A request with the green tenant JWT must only see green cab data.

## Langfuse tracing

Instrument all API endpoints with Langfuse tracing:
- Create a trace per request with the endpoint path and tenant info
- Add spans for authentication, query generation, and ClickHouse execution
- Record latency, row counts, and any errors

Environment variables:
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST`

All keys must be read from environment variables, never hardcoded. If Langfuse is unreachable, the API must still function normally -- tracing failures should be caught and logged, not thrown.

## Output

Fill in `/workspace/assertions.json` with:
- `tables.trips` -- fully qualified name of the trips table (e.g., `analytics.trips`)
- `tables.daily_metrics` -- fully qualified name of the daily metrics table
- `api_endpoints.trips` -- the trips endpoint path (e.g., `/api/trips`)
- `api_endpoints.metrics` -- the metrics endpoint path (e.g., `/api/metrics`)
- `api_endpoints.summary` -- the summary endpoint path (e.g., `/api/summary`)
- `auth.jwt_header` -- the HTTP header used for auth (e.g., `Authorization`)
- `auth.tenant_claim` -- the JWT claim used for tenant isolation (e.g., `tenant`)
- `observability.langfuse_configured` -- boolean indicating Langfuse is wired up
