CREATE SCHEMA IF NOT EXISTS raw;

DROP TABLE IF EXISTS raw.events;

CREATE TABLE raw.events (
  id SERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

INSERT INTO raw.events (received_at, payload) VALUES
  ('2026-01-15T10:00:00Z', '{"session_id": "s001", "event_type": "page_view", "user_id": "u001", "value": 0}'),
  ('2026-01-15T10:02:00Z', '{"session_id": "s001", "event_type": "click", "user_id": "u001", "value": 0}'),
  ('2026-01-15T10:05:00Z', '{"session_id": "s001", "event_type": "purchase", "user_id": "u001", "value": 49.99}'),
  ('2026-01-15T11:00:00Z', '{"session_id": "s002", "event_type": "page_view", "user_id": "u002", "value": 0}'),
  ('2026-01-15T11:03:00Z', '{"session_id": "s002", "event_type": "click", "user_id": "u002", "value": 0}'),
  ('2026-01-16T09:00:00Z', '{"session_id": "s003", "event_type": "page_view", "user_id": "u001", "value": 0}'),
  ('2026-01-16T09:10:00Z', '{"session_id": "s003", "event_type": "purchase", "user_id": "u001", "value": 120.00}'),
  ('2026-01-16T14:00:00Z', '{"session_id": "s004", "event_type": "page_view", "user_id": "u003", "value": 0}'),
  ('2026-01-17T08:30:00Z', '{"session_id": "s005", "event_type": "page_view", "user_id": "u004", "value": 0}'),
  ('2026-01-17T08:35:00Z', '{"session_id": null, "event_type": "click", "user_id": "u004", "value": null}');
