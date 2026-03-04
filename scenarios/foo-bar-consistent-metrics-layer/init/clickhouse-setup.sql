CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_ts DateTime,
  user_id String,
  event_type String,
  value Float64
) ENGINE = MergeTree()
ORDER BY (event_ts, user_id);

INSERT INTO analytics.events (event_ts, user_id, event_type, value) VALUES
  ('2026-01-15 10:00:00', 'u1', 'pageview', 0),
  ('2026-01-15 11:00:00', 'u2', 'pageview', 0),
  ('2026-01-15 12:00:00', 'u1', 'purchase', 29.99),
  ('2026-01-16 09:00:00', 'u1', 'pageview', 0),
  ('2026-01-16 10:00:00', 'u3', 'purchase', 49.99);

-- Broken: uses count() instead of uniqExact(user_id) for DAU
CREATE TABLE analytics.daily_metrics (
  day Date,
  dau UInt64,
  revenue Float64
) ENGINE = SummingMergeTree()
ORDER BY day;

INSERT INTO analytics.daily_metrics
SELECT
  toDate(event_ts) AS day,
  count() AS dau,
  sum(value) AS revenue
FROM analytics.events
GROUP BY day;
