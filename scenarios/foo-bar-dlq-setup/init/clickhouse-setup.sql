CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
  event_id String,
  event_ts DateTime,
  payload String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);
