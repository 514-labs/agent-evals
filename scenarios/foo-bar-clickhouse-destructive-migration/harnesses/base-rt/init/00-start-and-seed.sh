#!/usr/bin/env bash
# Per-harness init for base-rt: start system ClickHouse, seed pre-migration data.
# Moved here from flat init/ because scenario-global supervisord.conf is empty
# (the moose harnesses run their own ClickHouse via `moose dev --dockerless`).
set -euo pipefail

# Ownership on data + log dirs; harmless if already correct.
chown -R clickhouse:clickhouse /var/lib/clickhouse 2>/dev/null || true
mkdir -p /var/log/clickhouse-server
chown -R clickhouse:clickhouse /var/log/clickhouse-server 2>/dev/null || true

# Start ClickHouse in the background as the clickhouse user.
su -s /bin/bash clickhouse -c '/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml --daemon'

# Wait up to 60s for readiness on the HTTP port.
READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://localhost:8123/?query=SELECT%201" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "ERROR: ClickHouse never became ready on 8123" >&2
  tail -80 /var/log/clickhouse-server/clickhouse-server.log 2>/dev/null || true
  exit 1
fi

# Seed the pre-migration schema + 8 deterministic rows.
clickhouse-client --host localhost --port 9000 --multiquery <<'EOF'
CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events (event_id, event_ts, event_type, user_id) VALUES
  ('e1', '2026-01-15 10:00:00', 'pv',       'u1_001'),
  ('e2', '2026-01-15 10:01:00', 'pv',       'u1_002'),
  ('e3', '2026-01-15 11:00:00', 'click',    'u2_001'),
  ('e4', '2026-01-16 09:00:00', 'pv',       'u1_003'),
  ('e5', '2026-01-16 09:05:00', 'pv',       'u3_001'),
  ('e6', '2026-01-16 10:00:00', 'purchase', 'u2_001'),
  ('e7', '2026-01-17 14:00:00', 'click',    'u1_004'),
  ('e8', '2026-01-17 14:30:00', 'purchase', 'u3_001');
EOF

echo "00-start-and-seed.sh (${EVAL_HARNESS:-unknown}): done"
