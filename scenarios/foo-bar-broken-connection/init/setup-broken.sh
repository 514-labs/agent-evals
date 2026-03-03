#!/bin/bash

mkdir -p /workspace

cat > /workspace/init.sql << 'SQEOF'
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.users
  user_id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
SQEOF

cat > /workspace/load_data.py << 'PYEOF'
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5433,
    user="admin",
    password="secret123",
    dbname="postgres"
)

cur = conn.cursor()
cur.execute("INSERT INTO app.users (username, email) VALUES ('alice', 'alice@example.com')")
cur.execute("INSERT INTO app.users (username, email) VALUES ('bob', 'bob@example.com')")
cur.execute("INSERT INTO app.users (username, email) VALUES ('charlie', 'charlie@example.com')")
cur.execute("INSERT INTO app.users (username, email) VALUES ('diana', 'diana@example.com')")
cur.execute("INSERT INTO app.users (username, email) VALUES ('eve', 'eve@example.com')")
conn.commit()
cur.close()
conn.close()
print("Data loaded successfully")
PYEOF

echo 'export POSTGRES_URL="postgresql://postgres:postgres@localhost:5433/postgres"' >> /root/.bashrc
