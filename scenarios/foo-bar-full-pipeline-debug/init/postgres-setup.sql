CREATE SCHEMA IF NOT EXISTS app;

DROP TABLE IF EXISTS app.events;

CREATE TABLE app.events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app.events (event_type, user_id, payload, created_at) VALUES
  ('page_view', 'u001', '{"page": "/home"}', '2026-01-15T09:00:00Z'),
  ('click', 'u001', '{"element": "cta"}', '2026-01-15T09:01:00Z'),
  ('page_view', 'u002', '{"page": "/products"}', '2026-01-15T09:05:00Z'),
  ('purchase', 'u002', '{"amount": 49.99}', '2026-01-15T09:10:00Z'),
  ('page_view', 'u003', '{"page": "/home"}', '2026-01-15T09:15:00Z'),
  ('click', 'u003', '{"element": "nav"}', '2026-01-15T09:16:00Z'),
  ('page_view', 'u004', '{"page": "/about"}', '2026-01-15T09:20:00Z'),
  ('purchase', 'u004', '{"amount": 120.00}', '2026-01-15T09:25:00Z'),
  ('page_view', 'u005', '{"page": "/products"}', '2026-01-15T09:30:00Z'),
  ('click', 'u005', '{"element": "add_to_cart"}', '2026-01-15T09:31:00Z');
