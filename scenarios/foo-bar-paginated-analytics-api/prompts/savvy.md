Build a paginated analytics API on port 3000.

Endpoint: `GET /api/events?limit=20&offset=0` (or cursor-based). Return JSON with `data` (array of events), `total` (total row count), and `hasMore`. Use `analytics.events` in ClickHouse. Ensure consistent ordering (e.g. by event_ts, event_id) so pages don't overlap or skip rows. The API must handle limit and offset (or equivalent) query params.
