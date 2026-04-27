#!/usr/bin/env bash
# moose-initialized seed:
#   1. Bring up an empty Moose project in /workspace/moose-project pointed at the
#      `analytics` database.
#   2. Start `moose dev --dockerless` so its native ClickHouse (port 18123 HTTP,
#      9000 TCP, panda/pandapass) is the only ClickHouse running in the container.
#   3. Run the shared seed (same DDL + 100M rows + baseline capture as base-rt)
#      against that ClickHouse, so the agent sees an identical starting state.
#
# The `analytics.events` table is created via raw clickhouse-client on purpose
# (not as a Moose OlapTable). The agent can choose to layer Moose-managed
# MaterializedViews on top, change ORDER BY directly, add projections, etc. —
# whatever makes the canonical query meet the < 100ms target.
set -eu

mkdir -p /workspace
cd /workspace

if [[ ! -d moose-project ]]; then
  moose init moose-project typescript-empty
fi
cd moose-project

if [[ ! -d node_modules ]]; then
  npm install
fi

sed -i 's/^db_name = "local"$/db_name = "analytics"/' moose.config.toml

mkdir -p app
if [[ ! -f app/index.ts ]] || ! grep -q 'OlapTable\|MaterializedView' app/index.ts; then
  cat > app/index.ts <<'EOF'
// Empty Moose project. The slow `analytics.events` table is created outside
// of Moose (via raw DDL). You can layer Moose-managed views/projections on
// top of it from this file — e.g. a MaterializedView pre-aggregating by
// (region, day) — or change the underlying table directly. Either path is
// acceptable as long as the source data and query result stay intact.
export {};
EOF
fi

echo "=== starting moose dev --dockerless ==="
nohup moose dev --dockerless > /workspace/moose-project/moose.log 2>&1 &
MOOSE_PID=$!
echo "moose dev started (pid ${MOOSE_PID})"

CH_HTTP="http://panda:pandapass@localhost:18123"
ready=0
for i in $(seq 1 180); do
  if curl -sf "${CH_HTTP}/?query=SELECT+1" >/dev/null 2>&1; then
    echo "Moose-managed ClickHouse ready after ${i}s"
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" != "1" ]]; then
  echo "ERROR: Moose's ClickHouse never came up. moose.log tail:" >&2
  tail -100 /workspace/moose-project/moose.log >&2 || true
  exit 1
fi

export CH_HOST="localhost"
export CH_TCP_PORT="9000"
export CH_HTTP_URL="${CH_HTTP}"
export CH_USER="panda"
export CH_PASSWORD="pandapass"

exec /scenario/_lib/seed.sh
