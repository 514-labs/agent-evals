CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.metrics (
  ts DateTime,
  metric_name String,
  value Float64
) ENGINE = MergeTree()
ORDER BY (ts, metric_name);

INSERT INTO analytics.metrics (ts, metric_name, value) VALUES
  ('2026-01-15 10:00:00', 'requests', 100),
  ('2026-01-15 10:00:00', 'errors', 2),
  ('2026-01-15 11:00:00', 'requests', 150),
  ('2026-01-15 11:00:00', 'errors', 1),
  ('2026-01-16 09:00:00', 'requests', 200),
  ('2026-01-16 09:00:00', 'errors', 5);
