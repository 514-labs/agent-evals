CREATE SCHEMA IF NOT EXISTS app;

DROP TABLE IF EXISTS app.transactions;

CREATE TABLE app.transactions (
  id SERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app.transactions (customer_id, amount, created_at) VALUES
  ('c001', 10.00, '2026-01-15T09:00:00Z'),
  ('c002', 25.50, '2026-01-15T09:05:00Z'),
  ('c003', 33.33, '2026-01-15T09:10:00Z'),
  ('c004', 47.99, '2026-01-15T09:15:00Z'),
  ('c005', 52.00, '2026-01-15T09:20:00Z'),
  ('c006', 18.75, '2026-01-15T09:25:00Z'),
  ('c007', 91.20, '2026-01-15T09:30:00Z'),
  ('c008', 12.00, '2026-01-15T09:35:00Z'),
  ('c009', 66.66, '2026-01-15T09:40:00Z'),
  ('c010', 5.99, '2026-01-15T09:45:00Z');
