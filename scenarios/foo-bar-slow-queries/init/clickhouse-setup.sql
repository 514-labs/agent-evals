CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events_log (
  event_id String,
  event_ts DateTime,
  user_id String,
  event_type String,
  page_url String,
  duration_ms UInt32,
  metadata String
) ENGINE = MergeTree()
ORDER BY tuple();

INSERT INTO analytics.events_log
SELECT
  concat('evt_', toString(number)) AS event_id,
  toDateTime('2026-01-01') + toIntervalSecond(rand() % (86400 * 90)) AS event_ts,
  concat('usr_', leftPad(toString(rand() % 5000), 4, '0')) AS user_id,
  arrayElement(['pageview', 'click', 'scroll', 'purchase', 'signup'], (rand() % 5) + 1) AS event_type,
  concat('/page/', toString(rand() % 200)) AS page_url,
  rand() % 30000 AS duration_ms,
  '{}' AS metadata
FROM numbers(10000000);
