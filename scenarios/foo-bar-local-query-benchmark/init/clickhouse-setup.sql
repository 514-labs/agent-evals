CREATE DATABASE IF NOT EXISTS analytics;

DROP TABLE IF EXISTS analytics.expected_q1;
DROP TABLE IF EXISTS analytics.expected_q2;
DROP TABLE IF EXISTS analytics.expected_q3;
DROP TABLE IF EXISTS analytics.events_local;

CREATE TABLE analytics.events_local (
  event_id UInt64,
  workspace_id UInt32,
  account_id UInt32,
  region LowCardinality(String),
  event_type LowCardinality(String),
  event_date Date,
  event_ts DateTime,
  duration_ms UInt16,
  bytes UInt32
) ENGINE = MergeTree()
ORDER BY (event_id);

INSERT INTO analytics.events_local
SELECT
  number + 1 AS event_id,
  (number % 400) + 1 AS workspace_id,
  (number % 50000) + 1 AS account_id,
  arrayElement(['us-east', 'us-west', 'eu-central', 'ap-south'], (number % 4) + 1) AS region,
  arrayElement(['pageview', 'click', 'purchase', 'export'], ((intDiv(number, 7) % 4) + 1)) AS event_type,
  toDate('2026-01-01') + toIntervalDay(number % 90) AS event_date,
  toDateTime('2026-01-01 00:00:00') + toIntervalSecond(number % 7776000) AS event_ts,
  toUInt16(50 + (number % 950)) AS duration_ms,
  toUInt32(100 + (number % 5000)) AS bytes
FROM numbers(6000000);

CREATE TABLE analytics.expected_q1
ENGINE = Memory AS
SELECT
  toDate(event_ts) AS day,
  count() AS events,
  sum(bytes) AS total_bytes
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_date >= toDate('2026-02-01')
  AND event_date < toDate('2026-03-01')
GROUP BY day
ORDER BY day;

CREATE TABLE analytics.expected_q2
ENGINE = Memory AS
SELECT
  event_type,
  uniqExact(account_id) AS active_accounts,
  quantileExact(0.95)(duration_ms) AS p95_duration
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_date >= toDate('2026-02-01')
  AND event_date < toDate('2026-03-01')
GROUP BY event_type
ORDER BY event_type;

CREATE TABLE analytics.expected_q3
ENGINE = Memory AS
SELECT
  toStartOfHour(event_ts) AS hour,
  count() AS events
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_ts >= toDateTime('2026-02-10 00:00:00')
  AND event_ts < toDateTime('2026-02-12 00:00:00')
GROUP BY hour
ORDER BY hour;
