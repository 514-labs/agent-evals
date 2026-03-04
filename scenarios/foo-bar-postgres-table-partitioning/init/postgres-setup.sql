CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.events (
  id BIGSERIAL,
  created_at TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'
);

CREATE INDEX idx_events_created_at ON app.events (created_at);

INSERT INTO app.events (created_at, event_type, payload)
SELECT
  '2026-01-01'::timestamptz + (i || ' hours')::interval,
  (ARRAY['pageview', 'click', 'purchase'])[1 + (i % 3)],
  '{}'::jsonb
FROM generate_series(0, 719) AS i;
