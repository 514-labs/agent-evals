Build a stream-to-OLAP pipeline:

**Source**: Redpanda topic `metrics` with JSON messages: host_id (string), metric_name (string), value (float), ts (ISO timestamp).

**Target**: ClickHouse table `analytics.metrics` with columns: host_id, metric_name, value, ts (DateTime64). Use MergeTree with ORDER BY (host_id, metric_name, ts).

**Requirements**:
1. Consume from the metrics topic (at least the seeded messages).
2. Create the ClickHouse table with appropriate types and ordering.
3. Load all consumed messages into the table.
4. Support queries like: SELECT host_id, metric_name, avg(value) FROM analytics.metrics GROUP BY host_id, metric_name.