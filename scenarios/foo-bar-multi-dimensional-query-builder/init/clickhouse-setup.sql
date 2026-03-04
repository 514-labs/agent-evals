CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  ts DateTime,
  region_id UInt32,
  product_id UInt32,
  value Float64
) ENGINE = MergeTree()
ORDER BY (ts, region_id, product_id);

INSERT INTO analytics.events (ts, region_id, product_id, value) VALUES
  ('2026-01-15 10:00:00', 1, 1, 10.5),
  ('2026-01-15 11:00:00', 1, 2, 20.0),
  ('2026-01-16 09:00:00', 2, 1, 15.0),
  ('2026-01-16 10:00:00', 1, 1, 5.0),
  ('2026-01-17 08:00:00', 3, 3, 25.0);
