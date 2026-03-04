CREATE SCHEMA IF NOT EXISTS app;

DROP TABLE IF EXISTS app.order_snapshots;

CREATE TABLE app.order_snapshots (
  order_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Intentionally wrong: only 2 rows, missing others. Agent must replay to fix.
INSERT INTO app.order_snapshots (order_id, status, total_amount, updated_at) VALUES
  ('ord_001', 'active', 50.00, '2026-01-15T09:00:00Z'),
  ('ord_002', 'cancelled', 0, '2026-01-15T09:05:00Z');
