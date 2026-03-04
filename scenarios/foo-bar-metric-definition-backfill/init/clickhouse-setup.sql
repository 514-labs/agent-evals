CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.metric_daily (
  day Date,
  user_count UInt64,
  total_value Float64
) ENGINE = ReplacingMergeTree()
ORDER BY day;

-- Broken: partial backfill - only 2026-01-10, and with duplicates
INSERT INTO analytics.metric_daily (day, user_count, total_value) VALUES
  ('2026-01-10', 2, 30),
  ('2026-01-10', 2, 30);
