CREATE SCHEMA IF NOT EXISTS raw;

-- v1 events: 60 rows, no region/device columns
DROP TABLE IF EXISTS raw.events;

CREATE TABLE raw.events (
  event_id TEXT NOT NULL,
  event_ts TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0
);

INSERT INTO raw.events (event_id, event_ts, user_id, event_type, product_id, amount) VALUES
  -- Day 1: Jan 15
  ('ev_001', '2026-01-15T08:00:00Z', 'u001', 'view',     'prod_A',   0.00),
  ('ev_002', '2026-01-15T08:05:00Z', 'u001', 'cart',     'prod_A',   0.00),
  ('ev_003', '2026-01-15T08:10:00Z', 'u001', 'purchase', 'prod_A',  29.99),
  ('ev_004', '2026-01-15T09:00:00Z', 'u002', 'view',     'prod_B',   0.00),
  ('ev_005', '2026-01-15T09:30:00Z', 'u002', 'view',     'prod_C',   0.00),
  ('ev_006', '2026-01-15T10:00:00Z', 'u003', 'view',     'prod_A',   0.00),
  ('ev_007', '2026-01-15T10:05:00Z', 'u003', 'cart',     'prod_A',   0.00),
  ('ev_008', '2026-01-15T10:10:00Z', 'u003', 'purchase', 'prod_A',  29.99),
  ('ev_009', '2026-01-15T11:00:00Z', 'u004', 'view',     'prod_D',   0.00),
  ('ev_010', '2026-01-15T11:05:00Z', 'u004', 'cart',     'prod_D',   0.00),
  ('ev_011', '2026-01-15T14:00:00Z', 'u005', 'view',     'prod_B',   0.00),
  ('ev_012', '2026-01-15T14:02:00Z', 'u005', 'cart',     'prod_B',   0.00),
  ('ev_013', '2026-01-15T14:05:00Z', 'u005', 'purchase', 'prod_B',  59.99),
  ('ev_014', '2026-01-15T15:00:00Z', 'u006', 'view',     'prod_A',   0.00),
  ('ev_015', '2026-01-15T15:30:00Z', 'u007', 'view',     'prod_D',   0.00),

  -- Day 2: Jan 16
  ('ev_016', '2026-01-16T08:00:00Z', 'u001', 'view',     'prod_C',   0.00),
  ('ev_017', '2026-01-16T08:05:00Z', 'u001', 'cart',     'prod_C',   0.00),
  ('ev_018', '2026-01-16T08:10:00Z', 'u001', 'purchase', 'prod_C',  14.50),
  ('ev_019', '2026-01-16T09:00:00Z', 'u008', 'view',     'prod_A',   0.00),
  ('ev_020', '2026-01-16T09:30:00Z', 'u008', 'cart',     'prod_A',   0.00),
  ('ev_021', '2026-01-16T10:00:00Z', 'u009', 'view',     'prod_D',   0.00),
  ('ev_022', '2026-01-16T10:05:00Z', 'u009', 'cart',     'prod_D',   0.00),
  ('ev_023', '2026-01-16T10:10:00Z', 'u009', 'purchase', 'prod_D',  99.00),
  ('ev_024', '2026-01-16T11:00:00Z', 'u010', 'view',     'prod_B',   0.00),
  ('ev_025', '2026-01-16T14:00:00Z', 'u002', 'cart',     'prod_B',   0.00),
  ('ev_026', '2026-01-16T14:05:00Z', 'u002', 'purchase', 'prod_B',  59.99),
  ('ev_027', '2026-01-16T15:00:00Z', 'u006', 'view',     'prod_E',   0.00),
  ('ev_028', '2026-01-16T15:05:00Z', 'u006', 'cart',     'prod_E',   0.00),
  ('ev_029', '2026-01-16T15:10:00Z', 'u006', 'purchase', 'prod_E',  45.00),
  ('ev_030', '2026-01-16T16:00:00Z', 'u007', 'view',     'prod_C',   0.00),

  -- Day 3: Jan 17
  ('ev_031', '2026-01-17T08:00:00Z', 'u001', 'view',     'prod_D',   0.00),
  ('ev_032', '2026-01-17T08:05:00Z', 'u001', 'purchase', 'prod_D',  99.00),
  ('ev_033', '2026-01-17T09:00:00Z', 'u011', 'view',     'prod_A',   0.00),
  ('ev_034', '2026-01-17T09:30:00Z', 'u012', 'view',     'prod_C',   0.00),
  ('ev_035', '2026-01-17T09:35:00Z', 'u012', 'cart',     'prod_C',   0.00),
  ('ev_036', '2026-01-17T10:00:00Z', 'u013', 'view',     'prod_B',   0.00),
  ('ev_037', '2026-01-17T10:05:00Z', 'u013', 'cart',     'prod_B',   0.00),
  ('ev_038', '2026-01-17T10:10:00Z', 'u013', 'purchase', 'prod_B',  59.99),
  ('ev_039', '2026-01-17T11:00:00Z', 'u014', 'view',     'prod_E',   0.00),
  ('ev_040', '2026-01-17T11:05:00Z', 'u014', 'cart',     'prod_E',   0.00),

  -- Day 4: Jan 18
  ('ev_041', '2026-01-18T08:00:00Z', 'u002', 'view',     'prod_A',   0.00),
  ('ev_042', '2026-01-18T08:05:00Z', 'u002', 'cart',     'prod_A',   0.00),
  ('ev_043', '2026-01-18T08:10:00Z', 'u002', 'purchase', 'prod_A',  29.99),
  ('ev_044', '2026-01-18T09:00:00Z', 'u015', 'view',     'prod_F',   0.00),
  ('ev_045', '2026-01-18T09:05:00Z', 'u015', 'cart',     'prod_F',   0.00),
  ('ev_046', '2026-01-18T09:10:00Z', 'u015', 'purchase', 'prod_F', 120.00),
  ('ev_047', '2026-01-18T10:00:00Z', 'u003', 'view',     'prod_D',   0.00),
  ('ev_048', '2026-01-18T10:30:00Z', 'u016', 'view',     'prod_A',   0.00),
  ('ev_049', '2026-01-18T11:00:00Z', 'u016', 'cart',     'prod_A',   0.00),
  ('ev_050', '2026-01-18T14:00:00Z', 'u017', 'view',     'prod_B',   0.00),

  -- Day 5: Jan 19
  ('ev_051', '2026-01-19T08:00:00Z', 'u004', 'view',     'prod_E',   0.00),
  ('ev_052', '2026-01-19T08:05:00Z', 'u004', 'purchase', 'prod_E',  45.00),
  ('ev_053', '2026-01-19T09:00:00Z', 'u018', 'view',     'prod_C',   0.00),
  ('ev_054', '2026-01-19T09:05:00Z', 'u018', 'cart',     'prod_C',   0.00),
  ('ev_055', '2026-01-19T09:10:00Z', 'u018', 'purchase', 'prod_C',  14.50),
  ('ev_056', '2026-01-19T10:00:00Z', 'u019', 'view',     'prod_F',   0.00),
  ('ev_057', '2026-01-19T10:05:00Z', 'u019', 'cart',     'prod_F',   0.00),
  ('ev_058', '2026-01-19T11:00:00Z', 'u020', 'view',     'prod_A',   0.00),
  ('ev_059', '2026-01-19T14:00:00Z', 'u020', 'cart',     'prod_A',   0.00),
  ('ev_060', '2026-01-19T14:05:00Z', 'u020', 'purchase', 'prod_A',  29.99);


-- v2 events: 40 rows WITH region and device columns
DROP TABLE IF EXISTS raw.events_v2;

CREATE TABLE raw.events_v2 (
  event_id TEXT NOT NULL,
  event_ts TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  region TEXT NOT NULL,
  device TEXT NOT NULL
);

INSERT INTO raw.events_v2 (event_id, event_ts, user_id, event_type, product_id, amount, region, device) VALUES
  -- Day 6: Jan 20
  ('ev_061', '2026-01-20T08:00:00Z', 'u001', 'view',     'prod_A',   0.00, 'us-east', 'desktop'),
  ('ev_062', '2026-01-20T08:05:00Z', 'u001', 'cart',     'prod_A',   0.00, 'us-east', 'desktop'),
  ('ev_063', '2026-01-20T08:10:00Z', 'u001', 'purchase', 'prod_A',  29.99, 'us-east', 'desktop'),
  ('ev_064', '2026-01-20T09:00:00Z', 'u021', 'view',     'prod_B',   0.00, 'us-west', 'mobile'),
  ('ev_065', '2026-01-20T09:30:00Z', 'u021', 'cart',     'prod_B',   0.00, 'us-west', 'mobile'),
  ('ev_066', '2026-01-20T09:35:00Z', 'u021', 'purchase', 'prod_B',  59.99, 'us-west', 'mobile'),
  ('ev_067', '2026-01-20T10:00:00Z', 'u022', 'view',     'prod_C',   0.00, 'eu-west', 'tablet'),
  ('ev_068', '2026-01-20T10:05:00Z', 'u022', 'cart',     'prod_C',   0.00, 'eu-west', 'tablet'),
  ('ev_069', '2026-01-20T10:10:00Z', 'u022', 'purchase', 'prod_C',  14.50, 'eu-west', 'tablet'),
  ('ev_070', '2026-01-20T11:00:00Z', 'u023', 'view',     'prod_D',   0.00, 'us-east', 'mobile'),

  -- Day 7: Jan 21
  ('ev_071', '2026-01-21T08:00:00Z', 'u024', 'view',     'prod_E',   0.00, 'us-west', 'desktop'),
  ('ev_072', '2026-01-21T08:05:00Z', 'u024', 'cart',     'prod_E',   0.00, 'us-west', 'desktop'),
  ('ev_073', '2026-01-21T08:10:00Z', 'u024', 'purchase', 'prod_E',  45.00, 'us-west', 'desktop'),
  ('ev_074', '2026-01-21T09:00:00Z', 'u025', 'view',     'prod_A',   0.00, 'eu-west', 'mobile'),
  ('ev_075', '2026-01-21T09:05:00Z', 'u025', 'cart',     'prod_A',   0.00, 'eu-west', 'mobile'),
  ('ev_076', '2026-01-21T10:00:00Z', 'u026', 'view',     'prod_F',   0.00, 'us-east', 'desktop'),
  ('ev_077', '2026-01-21T10:05:00Z', 'u026', 'cart',     'prod_F',   0.00, 'us-east', 'desktop'),
  ('ev_078', '2026-01-21T10:10:00Z', 'u026', 'purchase', 'prod_F', 120.00, 'us-east', 'desktop'),
  ('ev_079', '2026-01-21T11:00:00Z', 'u027', 'view',     'prod_B',   0.00, 'eu-west', 'tablet'),
  ('ev_080', '2026-01-21T14:00:00Z', 'u027', 'cart',     'prod_B',   0.00, 'eu-west', 'tablet'),

  -- Day 8: Jan 22
  ('ev_081', '2026-01-22T08:00:00Z', 'u028', 'view',     'prod_D',   0.00, 'us-east', 'mobile'),
  ('ev_082', '2026-01-22T08:05:00Z', 'u028', 'cart',     'prod_D',   0.00, 'us-east', 'mobile'),
  ('ev_083', '2026-01-22T08:10:00Z', 'u028', 'purchase', 'prod_D',  99.00, 'us-east', 'mobile'),
  ('ev_084', '2026-01-22T09:00:00Z', 'u029', 'view',     'prod_A',   0.00, 'us-west', 'desktop'),
  ('ev_085', '2026-01-22T09:05:00Z', 'u029', 'cart',     'prod_A',   0.00, 'us-west', 'desktop'),
  ('ev_086', '2026-01-22T09:10:00Z', 'u029', 'purchase', 'prod_A',  29.99, 'us-west', 'desktop'),
  ('ev_087', '2026-01-22T10:00:00Z', 'u030', 'view',     'prod_C',   0.00, 'eu-west', 'mobile'),
  ('ev_088', '2026-01-22T10:05:00Z', 'u030', 'cart',     'prod_C',   0.00, 'eu-west', 'mobile'),
  ('ev_089', '2026-01-22T11:00:00Z', 'u002', 'view',     'prod_E',   0.00, 'us-east', 'tablet'),
  ('ev_090', '2026-01-22T14:00:00Z', 'u002', 'purchase', 'prod_E',  45.00, 'us-east', 'tablet'),

  -- Day 9: Jan 23
  ('ev_091', '2026-01-23T08:00:00Z', 'u003', 'view',     'prod_F',   0.00, 'us-west', 'mobile'),
  ('ev_092', '2026-01-23T08:05:00Z', 'u003', 'cart',     'prod_F',   0.00, 'us-west', 'mobile'),
  ('ev_093', '2026-01-23T08:10:00Z', 'u003', 'purchase', 'prod_F', 120.00, 'us-west', 'mobile'),
  ('ev_094', '2026-01-23T09:00:00Z', 'u004', 'view',     'prod_B',   0.00, 'eu-west', 'desktop'),
  ('ev_095', '2026-01-23T09:05:00Z', 'u004', 'cart',     'prod_B',   0.00, 'eu-west', 'desktop'),
  ('ev_096', '2026-01-23T09:10:00Z', 'u004', 'purchase', 'prod_B',  59.99, 'eu-west', 'desktop'),
  ('ev_097', '2026-01-23T10:00:00Z', 'u005', 'view',     'prod_D',   0.00, 'us-east', 'mobile'),
  ('ev_098', '2026-01-23T10:30:00Z', 'u005', 'cart',     'prod_D',   0.00, 'us-east', 'mobile'),
  ('ev_099', '2026-01-23T11:00:00Z', 'u006', 'view',     'prod_A',   0.00, 'us-west', 'tablet'),
  ('ev_100', '2026-01-23T14:00:00Z', 'u006', 'purchase', 'prod_A',  29.99, 'us-west', 'tablet');
