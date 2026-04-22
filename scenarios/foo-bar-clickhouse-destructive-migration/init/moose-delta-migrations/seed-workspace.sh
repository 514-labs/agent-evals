#!/usr/bin/env bash
# Per-harness init for moose-delta-migrations. Identical to the legacy
# script except for the features.migrate_with_deltas edit.
set -euo pipefail

cd /workspace
moose init migrations_demo typescript-empty
cd migrations_demo

npm install @514labs/moose-lib@0.6.521

# Enable delta migrations. Handle all three template states idempotently:
#  1. flag already present (re-run case) → normalize to true
#  2. [features] section exists but no flag → insert after the heading
#  3. no [features] section at all → append one
if grep -q "^migrate_with_deltas" moose.config.toml; then
  sed -i 's|^migrate_with_deltas.*|migrate_with_deltas = true|' moose.config.toml
elif grep -q "^\[features\]" moose.config.toml; then
  sed -i '/^\[features\]/a migrate_with_deltas = true' moose.config.toml
else
  printf '\n[features]\nmigrate_with_deltas = true\n' >> moose.config.toml
fi

# Fail loudly if the edit didn't land — silently running the legacy path
# would make the whole cross-harness comparison meaningless.
grep -qE "^migrate_with_deltas\s*=\s*true" moose.config.toml || {
  echo "moose.config.toml: migrate_with_deltas flag did not land" >&2
  cat moose.config.toml >&2
  exit 1
}

cat > app/index.ts <<'EOF'
import { OlapTable, Key } from "@514labs/moose-lib";

interface Event {
  event_id: Key<string>;
  event_ts: Date;
  event_type: string;
  user_id: string;
}

export const events = new OlapTable<Event>("events");
EOF

moose dev --dockerless > /tmp/moose-dev-seed.log 2>&1 &
MOOSE_PID=$!

READY=0
for _ in $(seq 1 90); do
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

echo "seed-workspace.sh (moose-delta-migrations): done"
