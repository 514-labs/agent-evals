CREATE SCHEMA IF NOT EXISTS app;

DROP TABLE IF EXISTS app.orders;

CREATE TABLE app.orders (
  id SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app.orders (customer_id, amount, created_at) VALUES
  ('cust_001', 29.99, '2026-01-15T09:00:00Z'),
  ('cust_002', 59.50, '2026-01-15T09:15:00Z'),
  ('cust_003', 14.25, '2026-01-15T10:00:00Z'),
  ('cust_004', 99.00, '2026-01-15T10:30:00Z'),
  ('cust_005', 42.75, '2026-01-15T11:00:00Z'),
  ('cust_006', 7.99, '2026-01-15T11:45:00Z'),
  ('cust_007', 155.00, '2026-01-15T12:00:00Z'),
  ('cust_008', 33.33, '2026-01-15T13:00:00Z'),
  ('cust_009', 88.88, '2026-01-15T14:00:00Z'),
  ('cust_010', 21.50, '2026-01-15T15:00:00Z');
