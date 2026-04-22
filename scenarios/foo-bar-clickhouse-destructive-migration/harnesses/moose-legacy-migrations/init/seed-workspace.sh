#!/usr/bin/env bash
# Per-harness init for moose-legacy-migrations. Runs only when this harness
# is active. Scaffolds a moose project pinned to moose-lib 0.6.521 with
# features.migrate_with_deltas NOT set (defaults to false → legacy plan.yaml).
set -euo pipefail

cd /workspace
moose init migrations_demo typescript-empty
cd migrations_demo

npm install @514labs/moose-lib@0.6.521

# Replace the template's default OlapTable with our pre-migration schema.
cat > app/index.ts <<'EOF'
import { OlapTable, Key } from "@514labs/moose-lib";

interface Event {
  event_id: Key<string>;
  event_ts: Date;
  event_type: string;
  user_id: string;
}

export const events = new OlapTable<Event>("events", {
  orderByFields: ["event_ts", "event_id"],
  primaryKeyExpression: "(event_ts, event_id)",
});
EOF

# Bring up ClickHouse (18123) + devredis (6379), seed rows, tear down cleanly.
moose dev --dockerless > /tmp/moose-dev-seed.log 2>&1 &
MOOSE_PID=$!

READY=0
for _ in $(seq 1 300); do
  if curl -fsS --max-time 2 "http://panda:pandapass@localhost:18123/?query=SELECT%201" >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "moose dev --dockerless did not become ready" >&2
  tail -80 /tmp/moose-dev-seed.log >&2
  kill $MOOSE_PID 2>/dev/null || true
  exit 1
fi

# Wait for moose to materialize local.events from the OlapTable<Event>
# declaration in app/index.ts. ClickHouse being up doesn't mean moose has
# applied the inframap yet — there's a compile + apply step after.
TABLE_READY=0
for _ in $(seq 1 300); do
  EXISTS=$(curl -fsS -u panda:pandapass \
    "http://localhost:18123/?query=SELECT+count()+FROM+system.tables+WHERE+database%3D%27local%27+AND+name%3D%27events%27+FORMAT+TSV" \
    2>/dev/null | tr -d '[:space:]')
  if [[ "${EXISTS}" == "1" ]]; then
    TABLE_READY=1
    break
  fi
  sleep 1
done
if [[ "${TABLE_READY}" != "1" ]]; then
  echo "ERROR: moose did not materialize local.events within 300s" >&2
  tail -120 /tmp/moose-dev-seed.log >&2
  kill $MOOSE_PID 2>/dev/null || true
  exit 1
fi

curl -fsS -u panda:pandapass --data-binary @- "http://localhost:18123/" <<'EOF'
INSERT INTO local.events (event_id, event_ts, event_type, user_id) VALUES
  ('e1', '2026-01-15 10:00:00', 'pv',       'u1_001'),
  ('e2', '2026-01-15 10:01:00', 'pv',       'u1_002'),
  ('e3', '2026-01-15 11:00:00', 'click',    'u2_001'),
  ('e4', '2026-01-16 09:00:00', 'pv',       'u1_003'),
  ('e5', '2026-01-16 09:05:00', 'pv',       'u3_001'),
  ('e6', '2026-01-16 10:00:00', 'purchase', 'u2_001'),
  ('e7', '2026-01-17 14:00:00', 'click',    'u1_004'),
  ('e8', '2026-01-17 14:30:00', 'purchase', 'u3_001')
EOF

kill $MOOSE_PID 2>/dev/null || true
wait $MOOSE_PID 2>/dev/null || true
rm -f .moose/native_infra/clickhouse/status 2>/dev/null || true

echo "seed-workspace.sh (moose-legacy-migrations): done"
