CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE app.products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO app.regions (id, name) VALUES (1, 'us-east'), (2, 'eu-west'), (3, 'apac');
INSERT INTO app.products (id, name) VALUES (1, 'widget_a'), (2, 'widget_b'), (3, 'widget_c');
