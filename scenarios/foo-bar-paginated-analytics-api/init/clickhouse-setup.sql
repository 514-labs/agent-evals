CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events
SELECT
  concat('evt_', toString(number)) AS event_id,
  toDateTime('2026-01-01') + toIntervalSecond(number % 86400) AS event_ts,
  arrayElement(['pageview', 'click', 'purchase'], (number % 3) + 1) AS event_type,
  concat('u', toString(number % 1000)) AS user_id
FROM numbers(15000);
