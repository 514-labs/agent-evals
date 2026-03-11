CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events (event_id, event_ts, event_type, user_id) VALUES
  ('e1', '2026-01-15 10:00:00', 'pv', 'u1_001'),
  ('e2', '2026-01-15 10:01:00', 'pv', 'u1_002'),
  ('e3', '2026-01-15 11:00:00', 'click', 'u2_001'),
  ('e4', '2026-01-16 09:00:00', 'pv', 'u1_003'),
  ('e5', '2026-01-16 09:05:00', 'pv', 'u3_001');
