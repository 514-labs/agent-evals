CREATE SCHEMA IF NOT EXISTS raw;

CREATE TABLE raw.events (
  id SERIAL PRIMARY KEY,
  event_ts TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  value NUMERIC(10,2) DEFAULT 0
);

INSERT INTO raw.events (event_ts, user_id, event_type, value) VALUES
  ('2026-01-15 10:00:00', 'u1', 'pageview', 0),
  ('2026-01-15 11:00:00', 'u2', 'pageview', 0),
  ('2026-01-15 12:00:00', 'u1', 'purchase', 29.99),
  ('2026-01-16 09:00:00', 'u1', 'pageview', 0),
  ('2026-01-16 10:00:00', 'u3', 'purchase', 49.99);
