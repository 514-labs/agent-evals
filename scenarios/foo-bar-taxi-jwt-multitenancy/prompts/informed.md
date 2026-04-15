Build a JWT-secured multi-tenant analytics API for NYC taxi trip data.

## Data

Pre-seeded in ClickHouse:
- `raw.yellow_trips_2024_01` — ~2.96M rows of yellow taxi trips
- `raw.green_trips_2024_01` — ~85K rows of green taxi trips

Design an analytics table that unifies both datasets with a `taxi_type` column (`'yellow'` or `'green'`).

## Auth Setup

- Shared secret: `/data/auth/jwt-secret.txt` (HS256)
- Pre-signed tokens: `/data/auth/yellow-tenant.jwt` and `/data/auth/green-tenant.jwt`
- Each JWT has a `tenant` claim (`"yellow"` or `"green"`) and a `sub` claim for the user ID.

## API Requirements

- Base URL: `http://localhost:3000`
- JWT is sent in the `Authorization` header as `Bearer <token>`
- The `tenant` claim in the JWT determines which `taxi_type` the user can see.

### Endpoints

1. `GET /trips` — Returns trip data for the authenticated tenant. Supports `?limit=` and `?offset=` for pagination.
2. `GET /trips/summary` — Returns aggregate stats (total trips, total revenue, average fare) for the authenticated tenant.

### Expected Row Counts

- Yellow tenant token → should see ~2.96M trips (only `taxi_type = 'yellow'`)
- Green tenant token → should see ~85K trips (only `taxi_type = 'green'`)
- No cross-tenant leakage: yellow token must never return green trips and vice versa.

### Security

- Missing or invalid JWT → HTTP 401
- JWT secret must be read from `/data/auth/jwt-secret.txt`, not hardcoded.

## Output

Fill in `/workspace/assertions.json` with the `trips_endpoint` path (e.g., `/trips`).
