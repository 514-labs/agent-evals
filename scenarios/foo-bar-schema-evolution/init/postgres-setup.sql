CREATE SCHEMA IF NOT EXISTS app;

DROP TABLE IF EXISTS app.products;

CREATE TABLE app.products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  category TEXT NOT NULL
);

INSERT INTO app.products (name, price, category) VALUES
  ('Widget A', 12.99, 'widgets'),
  ('Widget B', 24.50, 'widgets'),
  ('Gadget Pro', 89.99, 'gadgets'),
  ('Gadget Lite', 45.00, 'gadgets'),
  ('Thingamajig', 7.25, 'accessories'),
  ('Doohickey', 15.75, 'accessories'),
  ('Sprocket S', 33.00, 'parts'),
  ('Sprocket M', 41.50, 'parts'),
  ('Sprocket L', 55.00, 'parts'),
  ('Bolt Pack 100', 9.99, 'fasteners'),
  ('Bolt Pack 500', 39.99, 'fasteners'),
  ('Nut Assortment', 14.50, 'fasteners'),
  ('Cable 1m', 5.99, 'cables'),
  ('Cable 3m', 11.99, 'cables'),
  ('Cable 10m', 29.99, 'cables'),
  ('Adapter USB-C', 8.50, 'adapters'),
  ('Adapter HDMI', 12.00, 'adapters'),
  ('Mount Kit', 22.75, 'mounts'),
  ('Stand Adjustable', 67.00, 'mounts'),
  ('Toolkit Basic', 49.99, 'kits');
