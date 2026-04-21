Fix the analytics API on port 3000 that fails under concurrent requests.

The `/api/metrics` endpoint queries ClickHouse but uses a single shared connection. Under concurrent load it returns 500s, connection errors, or inconsistent results. Implement connection pooling or per-request connections so the API handles at least 5 concurrent requests successfully. The response must be valid JSON with a `total` field.
