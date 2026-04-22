Optimize the layout of `raw.metrics` (5M rows) for these three query patterns:

1. `SELECT toDate(ts) AS day, avg(value) FROM raw.metrics WHERE metric_name = 'cpu_usage' AND ts >= '2026-01-01' GROUP BY day ORDER BY day`
2. `SELECT host_id, sum(value) FROM raw.metrics WHERE metric_name = 'memory_usage' AND ts BETWEEN '2026-01-15' AND '2026-01-16' GROUP BY host_id`
3. `SELECT metric_name, count() FROM raw.metrics WHERE host_id = 'host_042' GROUP BY metric_name`

Create an optimized table `analytics.metrics_optimized` with appropriate ORDER BY, PARTITION BY, and codec settings. Migrate data from `raw.metrics`.
