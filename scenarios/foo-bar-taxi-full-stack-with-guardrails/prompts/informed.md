Build a full-stack analytics platform for NYC taxi trip data on ClickHouse with all of the following components.

## Data ingestion

Fetch yellow and green taxi trip parquet files for January and February 2024:

- `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet`
- `https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-02.parquet`
- `https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet`
- `https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-02.parquet`

Expected totals: ~6M rows across both months and both taxi types.

Load into a `raw` database first, then transform into a unified analytics table.

## Schema design

- Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`.
- Green has an extra `trip_type` column.
- Unify into a single analytics table (e.g., `analytics.trips`) with:
  - A `taxi_type` column (`'yellow'` or `'green'`)
  - Unified `pickup_datetime` / `dropoff_datetime` columns
  - `ORDER BY (taxi_type, pickup_datetime)` for efficient tenant + time-range queries
  - `PARTITION BY toYYYYMM(pickup_datetime)` for scalability
- Create a daily metrics materialized view or rollup table (e.g., `analytics.daily_metrics`).
- Ingest the PII test data from `/data/taxi/rider_notes.csv` into a `raw.rider_notes` table for guardrail testing.

## Semantic metrics layer

Define at least these metrics in a declarative config file:
1. **avg_fare** -- average `fare_amount`
2. **total_revenue** -- sum of `total_amount`
3. **trips_per_day** -- count of trips grouped by date
4. **avg_distance** -- average `trip_distance`

## API endpoints

Build an HTTP API server (port 3000) with at least these endpoints:
- `GET /api/trips` -- paginated trip listing, filtered by taxi_type from JWT
- `GET /api/metrics/:name` -- compute and return a named metric, scoped to the tenant
- `GET /api/summary` -- dashboard summary with total trips, revenue, and average fare

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header. Unauthenticated requests must return HTTP 401.

## Natural language chat interface

- `POST /api/chat` -- accepts `{"question": "..."}` body, translates to ClickHouse SQL, returns the answer
- The chat endpoint must scope queries to the authenticated tenant's taxi type
- SQL injection attempts or nonsensical questions should return a graceful error, not crash
- All chat responses must pass through PII guardrails before being returned

Expected response shape:
```json
{"answer": "The average fare for yellow cabs in January 2024 was $15.72", "sql": "SELECT avg(fare_amount)..."}
```

## JWT authentication

Auth materials are pre-staged in `/data/auth/`:
- `jwt-secret.txt` -- the HMAC signing secret
- `yellow-tenant.jwt` -- a pre-signed token with `{"tenant": "yellow"}` claim
- `green-tenant.jwt` -- a pre-signed token with `{"tenant": "green"}` claim

Read the JWT secret from the file. Verify tokens using HS256. Extract the `tenant` claim to scope all queries.

## PII guardrails (AWS Bedrock)

Integrate AWS Bedrock guardrails to scan outgoing responses for PII:
- Phone numbers (e.g., `555-123-4567`)
- Email addresses (e.g., `john@example.com`)
- SSNs (e.g., `123-45-6789`)
- Full names when combined with other PII

Test data in `/data/taxi/rider_notes.csv` contains synthetic PII entries. If a chat response or API response would contain PII, it must be redacted or blocked.

Environment variables:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `BEDROCK_GUARDRAIL_ID`

If Bedrock is unreachable, responses containing potential PII should be blocked (fail-closed for PII, fail-open for non-PII).

## Langfuse tracing

Instrument all API and chat endpoints:
- Create a trace per request with endpoint path, tenant info, and request metadata
- Add spans for: authentication, query generation, ClickHouse execution, guardrail check
- For chat: add a generation span for the LLM call with model, prompt, and completion

Environment variables:
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST`

All keys from environment variables, never hardcoded. Tracing failures must not break the API.

## Output

Fill in `/workspace/assertions.json` with:
- `tables.trips` -- fully qualified name of the trips table
- `tables.metrics` -- fully qualified name of the metrics/rollup table
- `api_endpoints` -- array of endpoint paths (e.g., `["/api/trips", "/api/metrics", "/api/summary"]`)
- `chat_endpoint` -- the chat endpoint path (e.g., `/api/chat`)
- `auth_enabled` -- boolean
- `guardrails_enabled` -- boolean
- `observability_enabled` -- boolean
