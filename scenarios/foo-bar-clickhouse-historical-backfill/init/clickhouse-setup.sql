CREATE DATABASE IF NOT EXISTS staging;
CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE staging.historical_events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO staging.historical_events
SELECT
  concat('evt_', toString(number)) AS event_id,
  toDateTime('2025-01-01') + toIntervalDay(number % 365) AS event_ts,
  'pageview' AS event_type,
  concat('u', toString(number % 500)) AS user_id
FROM numbers(5000);

-- Broken target: no partition, wrong order key causes slow backfill
CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY tuple();
