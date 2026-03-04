CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  user_id String,
  region String,
  revenue Float64
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events
SELECT
  concat('evt_', toString(number)) AS event_id,
  toDateTime('2026-01-01') + toIntervalSecond(rand() % (86400 * 90)) AS event_ts,
  concat('usr_', leftPad(toString(rand() % 10000), 4, '0')) AS user_id,
  arrayElement(['us-east', 'us-west', 'eu-central'], (rand() % 3) + 1) AS region,
  rand() % 100 AS revenue
FROM numbers(5000000);
