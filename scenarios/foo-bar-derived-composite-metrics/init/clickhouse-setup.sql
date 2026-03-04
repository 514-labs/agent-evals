CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  user_id String,
  event_type String,
  amount Float64 DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events (event_id, event_ts, user_id, event_type, amount)
SELECT
  concat('evt_', toString(n)) AS event_id,
  toDateTime('2026-01-01') + toIntervalSecond(rand() % (86400 * 30)) AS event_ts,
  concat('usr_', toString(rand() % 500)) AS user_id,
  et AS event_type,
  if(et = 'purchase', rand() % 100, 0) AS amount
FROM (
  SELECT number AS n, arrayElement(['view', 'view', 'view', 'cart', 'purchase'], (rand() % 5) + 1) AS et
  FROM numbers(100000)
);
