CREATE DATABASE IF NOT EXISTS analytics;

-- Broken: wrong schema or empty. Agent must fix consumer and table.
CREATE TABLE IF NOT EXISTS analytics.realtime_metrics (
  host_id String,
  metric_name String,
  value Float64,
  ts DateTime64(3)
) ENGINE = MergeTree()
ORDER BY (host_id, metric_name, ts);
