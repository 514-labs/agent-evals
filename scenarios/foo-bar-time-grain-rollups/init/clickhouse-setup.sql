CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.raw_events (
  event_id String,
  event_ts DateTime,
  event_type String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.raw_events (event_id, event_ts, event_type) VALUES
  ('e1', '2026-01-15 10:00:00', 'pv'),
  ('e2', '2026-01-15 10:30:00', 'pv'),
  ('e3', '2026-01-15 11:00:00', 'pv'),
  ('e4', '2026-01-16 09:00:00', 'pv'),
  ('e5', '2026-01-16 09:15:00', 'pv'),
  ('e6', '2026-02-01 08:00:00', 'pv');

-- Broken: daily rollup populated with zeros; hourly and monthly empty
CREATE TABLE analytics.rollup_hourly (
  hour DateTime,
  event_count UInt64
) ENGINE = SummingMergeTree()
ORDER BY hour;

CREATE TABLE analytics.rollup_daily (
  day Date,
  event_count UInt64
) ENGINE = SummingMergeTree()
ORDER BY day;

CREATE TABLE analytics.rollup_monthly (
  month Date,
  event_count UInt64
) ENGINE = SummingMergeTree()
ORDER BY month;

-- Broken: populated with 0 instead of actual count
INSERT INTO analytics.rollup_daily
SELECT toDate(event_ts) AS day, 0 AS event_count FROM analytics.raw_events;
