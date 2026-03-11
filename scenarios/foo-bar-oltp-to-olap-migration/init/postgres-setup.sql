CREATE SCHEMA IF NOT EXISTS app;

DROP TABLE IF EXISTS app.sales;

CREATE TABLE app.sales (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  sale_date DATE NOT NULL
);

INSERT INTO app.sales (product_id, quantity, amount, sale_date) VALUES
  ('p001', 2, 59.98, '2026-01-10'),
  ('p002', 1, 24.50, '2026-01-10'),
  ('p003', 3, 89.97, '2026-01-11'),
  ('p001', 1, 29.99, '2026-01-11'),
  ('p004', 2, 90.00, '2026-01-12'),
  ('p002', 2, 49.00, '2026-01-12'),
  ('p005', 1, 15.99, '2026-01-12'),
  ('p003', 1, 29.99, '2026-01-13'),
  ('p001', 4, 119.96, '2026-01-13'),
  ('p004', 1, 45.00, '2026-01-14'),
  ('p005', 3, 47.97, '2026-01-14'),
  ('p002', 1, 24.50, '2026-01-14'),
  ('p003', 2, 59.98, '2026-01-15'),
  ('p001', 1, 29.99, '2026-01-15'),
  ('p004', 1, 45.00, '2026-01-15');
