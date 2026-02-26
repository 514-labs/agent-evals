CREATE SCHEMA IF NOT EXISTS raw;

DROP TABLE IF EXISTS raw.orders;

CREATE TABLE raw.orders (
  order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  order_ts TIMESTAMPTZ NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL
);

INSERT INTO raw.orders (order_id, customer_id, order_ts, total_amount) VALUES
  ('ord_001', 'cust_001', '2026-01-01T10:03:00Z', 120.00),
  ('ord_002', 'cust_002', '2026-01-01T11:05:00Z', 55.10),
  ('ord_002', 'cust_002', '2026-01-01T11:05:00Z', 55.10), -- duplicate event
  ('ord_003', 'cust_003', '2026-01-02T08:15:00Z', 99.99),
  ('ord_004', 'cust_001', '2026-01-02T14:20:00Z', 42.50),
  ('ord_005', 'cust_004', '2026-01-03T09:50:00Z', 310.00);
