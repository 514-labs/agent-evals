CREATE DATABASE IF NOT EXISTS analytics;

-- Broken: wrong column names or types. Agent must fix schema and sync.
CREATE TABLE IF NOT EXISTS analytics.sales (
  id UInt32,
  product_id String,
  quantity Int32,
  amount Float64,
  sale_date Date
) ENGINE = MergeTree()
ORDER BY (sale_date, product_id);
