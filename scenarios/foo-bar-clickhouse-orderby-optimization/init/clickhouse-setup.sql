CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  region String,
  event_ts DateTime,
  amount Float64
) ENGINE = MergeTree()
ORDER BY tuple();

INSERT INTO analytics.events
SELECT
  concat('evt_', toString(number)) AS event_id,
  arrayElement(['us-east', 'us-west', 'eu-central'], (rand() % 3) + 1) AS region,
  toDateTime('2026-01-01') + toIntervalSecond(rand() % (86400 * 90)) AS event_ts,
  rand() % 1000 AS amount
FROM numbers(2000000);
