Build a dashboard backend API for NYC taxi trip data with materialized views for performance.

## Data

Pre-seeded in ClickHouse:
- `raw.yellow_trips_2024_01` — ~2.96M rows of yellow taxi trips
- `raw.green_trips_2024_01` — ~85K rows of green taxi trips

Design an analytics table that unifies both datasets with a `taxi_type` column (`'yellow'` or `'green'`). Use `ORDER BY (taxi_type, pickup_datetime)` for efficient filtering.

## Materialized Views

You need materialized views for sub-200ms response times on 3M+ rows:
1. **Daily aggregates** — trips, revenue, avg fare per day
2. **Taxi type breakdown** — trips, revenue per taxi type
3. **Top routes** — pickup/dropoff location pairs by trip count

## API Endpoints

Base URL: `http://localhost:3000`

### 1. `GET /summary`
Returns overall trip statistics:
```json
{"total_trips": 3049670, "total_revenue": 55000000, "avg_fare": 18.0, "avg_distance": 3.5}
```

### 2. `GET /daily-trend`
Returns daily aggregated data:
```json
[{"date": "2024-01-01", "trips": 85000, "revenue": 1500000, "avg_fare": 17.5}, ...]
```

### 3. `GET /taxi-type-breakdown`
Returns breakdown by taxi type (should have exactly 2 entries):
```json
[{"taxi_type": "yellow", "trips": 2964624, "revenue": 53000000}, {"taxi_type": "green", "trips": 85046, "revenue": 2000000}]
```

### 4. `GET /top-routes`
Returns top pickup/dropoff location pairs by trip count. Supports `?limit=` (default 10):
```json
[{"pickup_location": 236, "dropoff_location": 236, "trips": 50000}, ...]
```

## Expected Values (approximate)
- Total trips: ~3.05M (2,964,624 yellow + 85,046 green)
- Total revenue: ~$55M (sum of total_amount across both)
- Taxi type breakdown: exactly 2 entries (yellow and green)

## Output

Fill in `/workspace/assertions.json` with the endpoint paths for summary, daily_trend, taxi_type_breakdown, and top_routes.
