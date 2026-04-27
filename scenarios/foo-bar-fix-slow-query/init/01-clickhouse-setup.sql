CREATE DATABASE IF NOT EXISTS analytics;

DROP TABLE IF EXISTS analytics.events;

-- Plain String columns (not LowCardinality) and an unrelated sort key force
-- the canonical query to read region/event_ts/user_id from every granule
-- and run an exact-distinct over millions of rows. The agent's job is to
-- make this fast (ORDER BY tuning, projection, or rolled-up MaterializedView).
CREATE TABLE analytics.events (
  event_id   String,
  event_ts   DateTime,
  user_id    String,
  event_type String,
  region     String,
  value      Float64
)
ENGINE = MergeTree()
ORDER BY event_id;

INSERT INTO analytics.events
SELECT
  concat('evt_', leftPad(toString(number), 9, '0')),
  toDateTime('2026-01-01 00:00:00') + toIntervalSecond((number * 17) % (86400 * 60)),
  concat('usr_', leftPad(toString(cityHash64(number) % 5000000), 7, '0')),
  arrayElement(['pageview', 'click', 'scroll', 'purchase', 'signup'], (number % 5) + 1),
  arrayElement(['us-east', 'us-west', 'eu-west', 'apac', 'sa'], (number % 5) + 1),
  toFloat64(number % 1000) / 7.0
FROM numbers(100000000);
