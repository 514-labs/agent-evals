CREATE DATABASE IF NOT EXISTS analytics;

-- Empty or partial; agent must fix pipeline and reconciliation
CREATE TABLE IF NOT EXISTS analytics.transactions (
  id UInt32,
  customer_id String,
  amount Float64,
  created_at DateTime64(3)
) ENGINE = MergeTree()
ORDER BY id;
