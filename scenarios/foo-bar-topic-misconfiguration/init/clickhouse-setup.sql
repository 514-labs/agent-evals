CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.orders (
  order_id String,
  order_ts DateTime,
  user_id String,
  amount Float64
) ENGINE = MergeTree()
ORDER BY (order_ts, order_id);
