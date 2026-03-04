Optimize the analytical API:

1. API runs on port 3000 with endpoints: GET /api/metrics (total events, unique users, sum revenue) and GET /api/breakdown (events by region and day).
2. Both hit analytics.events (5M rows) with ad-hoc aggregations. Latency is 2+ seconds.
3. Create materialized views or pre-aggregated tables so the API queries hit precomputed data.
4. Target: both endpoints respond in under 200ms with correct results.
