CREATE SCHEMA IF NOT EXISTS raw;

DROP TABLE IF EXISTS raw.product_events;

CREATE TABLE raw.product_events (
  event_id TEXT NOT NULL,
  event_ts TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}'
);

INSERT INTO raw.product_events (event_id, event_ts, user_id, product_id, event_type, properties) VALUES
  -- Day 1: Jan 15
  ('ev_001', '2026-01-15T09:00:00Z', 'u001', 'prod_A', 'view',     '{}'),
  ('ev_002', '2026-01-15T09:05:00Z', 'u001', 'prod_A', 'cart',     '{}'),
  ('ev_003', '2026-01-15T09:10:00Z', 'u001', 'prod_A', 'purchase', '{"price": 29.99}'),
  ('ev_004', '2026-01-15T09:30:00Z', 'u002', 'prod_B', 'view',     '{}'),
  ('ev_005', '2026-01-15T09:35:00Z', 'u002', 'prod_B', 'view',     '{}'),
  ('ev_006', '2026-01-15T10:00:00Z', 'u003', 'prod_A', 'view',     '{}'),
  ('ev_007', '2026-01-15T10:05:00Z', 'u003', 'prod_A', 'cart',     '{}'),
  ('ev_008', '2026-01-15T10:10:00Z', 'u003', 'prod_A', 'purchase', '{"price": 29.99}'),
  ('ev_009', '2026-01-15T11:00:00Z', 'u004', 'prod_C', 'view',     '{}'),
  ('ev_010', '2026-01-15T11:05:00Z', 'u004', 'prod_C', 'cart',     '{}'),

  -- Day 1 afternoon
  ('ev_011', '2026-01-15T14:00:00Z', 'u005', 'prod_B', 'view',     '{}'),
  ('ev_012', '2026-01-15T14:02:00Z', 'u005', 'prod_B', 'cart',     '{}'),
  ('ev_013', '2026-01-15T14:05:00Z', 'u005', 'prod_B', 'purchase', '{"price": 59.99}'),
  ('ev_014', '2026-01-15T15:00:00Z', 'u006', 'prod_A', 'view',     '{}'),
  ('ev_015', '2026-01-15T15:30:00Z', 'u007', 'prod_D', 'view',     '{}'),

  -- Day 2: Jan 16
  ('ev_016', '2026-01-16T08:00:00Z', 'u001', 'prod_C', 'view',     '{}'),
  ('ev_017', '2026-01-16T08:05:00Z', 'u001', 'prod_C', 'cart',     '{}'),
  ('ev_018', '2026-01-16T08:10:00Z', 'u001', 'prod_C', 'purchase', '{"price": 14.50}'),
  ('ev_019', '2026-01-16T09:00:00Z', 'u008', 'prod_A', 'view',     '{}'),
  ('ev_020', '2026-01-16T09:30:00Z', 'u008', 'prod_A', 'cart',     '{}'),
  ('ev_021', '2026-01-16T10:00:00Z', 'u009', 'prod_D', 'view',     '{}'),
  ('ev_022', '2026-01-16T10:05:00Z', 'u009', 'prod_D', 'cart',     '{}'),
  ('ev_023', '2026-01-16T10:10:00Z', 'u009', 'prod_D', 'purchase', '{"price": 99.00}'),
  ('ev_024', '2026-01-16T11:00:00Z', 'u010', 'prod_B', 'view',     '{}'),
  ('ev_025', '2026-01-16T14:00:00Z', 'u002', 'prod_B', 'cart',     '{}'),

  -- Day 3: Jan 17
  ('ev_026', '2026-01-17T08:00:00Z', 'u001', 'prod_D', 'view',     '{}'),
  ('ev_027', '2026-01-17T08:05:00Z', 'u001', 'prod_D', 'purchase', '{"price": 99.00}'),
  ('ev_028', '2026-01-17T09:00:00Z', 'u011', 'prod_A', 'view',     '{}'),
  ('ev_029', '2026-01-17T09:30:00Z', 'u012', 'prod_C', 'view',     '{}'),
  ('ev_030', '2026-01-17T10:00:00Z', 'u012', 'prod_C', 'cart',     '{}');
