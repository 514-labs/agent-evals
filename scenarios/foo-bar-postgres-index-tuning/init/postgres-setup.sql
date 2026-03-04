CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.orders (
  order_id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10, 2) NOT NULL
);

INSERT INTO app.orders (user_id, created_at, amount)
SELECT
  'user_' || (random() * 1000)::int,
  '2025-01-01'::timestamptz + (random() * interval '90 days'),
  (random() * 1000)::numeric(10, 2)
FROM generate_series(1, 500000);
