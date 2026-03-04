CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.raw_events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

CREATE TABLE IF NOT EXISTS analytics.daily_event_summary (
  day Date,
  event_type String,
  event_count UInt64
) ENGINE = SummingMergeTree()
ORDER BY (day, event_type);

INSERT INTO analytics.raw_events (event_id, event_ts, event_type, user_id) VALUES
  ('e1', '2026-01-15 10:00:00', 'pageview', 'u1'),
  ('e2', '2026-01-15 10:01:00', 'click', 'u1'),
  ('e3', '2026-01-15 11:00:00', 'pageview', 'u2'),
  ('e4', '2026-01-16 09:00:00', 'pageview', 'u1'),
  ('e5', '2026-01-16 09:05:00', 'purchase', 'u1');

-- Broken MV: writes cnt but target expects event_count
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_event_summary_mv
TO analytics.daily_event_summary
AS SELECT
  toDate(event_ts) AS day,
  event_type,
  count() AS cnt
FROM analytics.raw_events
GROUP BY day, event_type;
