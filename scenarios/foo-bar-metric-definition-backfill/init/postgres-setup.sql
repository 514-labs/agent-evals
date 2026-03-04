CREATE SCHEMA IF NOT EXISTS raw;

CREATE TABLE raw.events (
  id SERIAL PRIMARY KEY,
  event_ts TIMESTAMPTZ NOT NULL,
  user_id TEXT NOT NULL,
  value NUMERIC(10,2) DEFAULT 0
);

INSERT INTO raw.events (event_ts, user_id, value) VALUES
  ('2026-01-10 10:00:00', 'u1', 10),
  ('2026-01-10 11:00:00', 'u2', 20),
  ('2026-01-11 09:00:00', 'u1', 5),
  ('2026-01-11 10:00:00', 'u3', 15),
  ('2026-01-12 08:00:00', 'u2', 25);
