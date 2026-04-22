Fix the realtime streaming metrics pipeline:

**Source**: Redpanda topic `metrics` with JSON: host_id, metric_name, value, ts (ISO timestamp).

**Target**: ClickHouse `analytics.realtime_metrics` with per-host, per-metric aggregations (e.g., avg, min, max, count) queryable in near realtime.

**Requirements**:
1. Consume from metrics topic and load into ClickHouse (raw or aggregated).
2. Create/repair analytics.realtime_metrics table or materialized view.
3. Support query: SELECT host_id, metric_name, avg(value), count() FROM analytics.realtime_metrics GROUP BY host_id, metric_name.
4. Ensure at least the seeded messages are reflected in query results.