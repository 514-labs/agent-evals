CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.products (
  id UInt32,
  name String,
  price Float64,
  category String
) ENGINE = MergeTree()
ORDER BY id;

INSERT INTO analytics.products (id, name, price, category) VALUES
  (1, 'Widget A', 12.99, 'widgets'),
  (2, 'Widget B', 24.50, 'widgets'),
  (3, 'Gadget Pro', 89.99, 'gadgets'),
  (4, 'Gadget Lite', 45.00, 'gadgets'),
  (5, 'Thingamajig', 7.25, 'accessories'),
  (6, 'Doohickey', 15.75, 'accessories'),
  (7, 'Sprocket S', 33.00, 'parts'),
  (8, 'Sprocket M', 41.50, 'parts'),
  (9, 'Sprocket L', 55.00, 'parts'),
  (10, 'Bolt Pack 100', 9.99, 'fasteners'),
  (11, 'Bolt Pack 500', 39.99, 'fasteners'),
  (12, 'Nut Assortment', 14.50, 'fasteners'),
  (13, 'Cable 1m', 5.99, 'cables'),
  (14, 'Cable 3m', 11.99, 'cables'),
  (15, 'Cable 10m', 29.99, 'cables'),
  (16, 'Adapter USB-C', 8.50, 'adapters'),
  (17, 'Adapter HDMI', 12.00, 'adapters'),
  (18, 'Mount Kit', 22.75, 'mounts'),
  (19, 'Stand Adjustable', 67.00, 'mounts'),
  (20, 'Toolkit Basic', 49.99, 'kits');
