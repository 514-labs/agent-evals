-- Chaos injection: introduces four categories of data quality issues

-- 1. NULL event_ids (5 rows)
INSERT INTO raw.events (event_id, event_type, user_id, event_ts, properties) VALUES
  (NULL, 'page_view', 'u030', '2026-01-20T15:00:00Z', '{"page": "/home"}'),
  (NULL, 'click', 'u031', '2026-01-20T15:05:00Z', '{"element": "cta"}'),
  (NULL, 'purchase', 'u032', '2026-01-20T15:10:00Z', '{"amount": 25.00}'),
  (NULL, 'page_view', 'u033', '2026-01-20T15:15:00Z', '{"page": "/products"}'),
  (NULL, 'click', 'u034', '2026-01-20T15:20:00Z', '{"element": "nav"}');

-- 2. Duplicate rows (10 rows: 5 events duplicated twice each)
INSERT INTO raw.events (event_id, event_type, user_id, event_ts, properties) VALUES
  ('evt_001', 'page_view', 'u001', '2026-01-20T10:00:00Z', '{"page": "/home"}'),
  ('evt_001', 'page_view', 'u001', '2026-01-20T10:00:00Z', '{"page": "/home"}'),
  ('evt_005', 'page_view', 'u003', '2026-01-20T10:15:00Z', '{"page": "/home"}'),
  ('evt_005', 'page_view', 'u003', '2026-01-20T10:15:00Z', '{"page": "/home"}'),
  ('evt_010', 'click', 'u005', '2026-01-20T10:31:00Z', '{"element": "add_to_cart"}'),
  ('evt_010', 'click', 'u005', '2026-01-20T10:31:00Z', '{"element": "add_to_cart"}'),
  ('evt_020', 'click', 'u010', '2026-01-20T11:31:00Z', '{"element": "filter_dropdown"}'),
  ('evt_020', 'click', 'u010', '2026-01-20T11:31:00Z', '{"element": "filter_dropdown"}'),
  ('evt_035', 'page_view', 'u018', '2026-01-20T13:15:00Z', '{"page": "/products"}'),
  ('evt_035', 'page_view', 'u018', '2026-01-20T13:15:00Z', '{"page": "/products"}');

-- 3. Schema drift: rows with an extra column that doesn't exist in the target schema
INSERT INTO raw.events (event_id, event_type, user_id, event_ts, properties) VALUES
  ('evt_drift_1', 'page_view', 'u040', '2026-01-20T16:00:00Z', '{"page": "/home", "device_type": "mobile"}'),
  ('evt_drift_2', 'click', 'u041', '2026-01-20T16:05:00Z', '{"element": "cta", "device_type": "tablet"}'),
  ('evt_drift_3', 'purchase', 'u042', '2026-01-20T16:10:00Z', '{"amount": 99.99, "device_type": "desktop"}');

-- 4. Stale timestamps (5 rows from 2020)
INSERT INTO raw.events (event_id, event_type, user_id, event_ts, properties) VALUES
  ('evt_stale_1', 'page_view', 'u050', '2020-03-15T10:00:00Z', '{"page": "/home"}'),
  ('evt_stale_2', 'click', 'u051', '2020-06-20T11:00:00Z', '{"element": "old_cta"}'),
  ('evt_stale_3', 'purchase', 'u052', '2020-09-01T12:00:00Z', '{"amount": 15.00}'),
  ('evt_stale_4', 'page_view', 'u053', '2020-11-10T13:00:00Z', '{"page": "/legacy"}'),
  ('evt_stale_5', 'click', 'u054', '2020-12-25T14:00:00Z', '{"element": "xmas_banner"}');
