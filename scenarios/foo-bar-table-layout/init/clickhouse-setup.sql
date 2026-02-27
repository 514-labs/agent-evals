CREATE DATABASE IF NOT EXISTS raw;
CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE raw.metrics (
  ts DateTime,
  host_id String,
  metric_name String,
  value Float64,
  tags String
) ENGINE = MergeTree()
ORDER BY tuple();

INSERT INTO raw.metrics
SELECT
  toDateTime('2026-01-01') + toIntervalSecond(rand() % (86400 * 31)) AS ts,
  concat('host_', leftPad(toString(rand() % 100), 3, '0')) AS host_id,
  arrayElement(['cpu_usage', 'memory_usage', 'disk_io', 'network_rx', 'network_tx'], (rand() % 5) + 1) AS metric_name,
  round(randNormal(50, 25), 2) AS value,
  '' AS tags
FROM numbers(5000000);
