#!/usr/bin/env bash
# Per-harness init for tinybird-forward. Brings up Tinybird Local as a
# sibling Docker container sharing the harness container's network
# namespace (so the `tb` CLI's hard-coded 127.0.0.1:7182 resolves),
# scaffolds the Tinybird project files, deploys the pre-migration schema,
# and seeds 10k rows + anchor data sources. Stops the Tinybird Local
# container at the end but leaves its volume intact so the agent can
# `docker start tb-local` and inherit the state.
#
# Why docker-run-direct and not `tb local start`:
#   `tb local start` spawns a Docker container with default flags — no
#   way to ask it to share the harness container's netns. Without that,
#   the Tinybird Local container's ports would bind on the host and be
#   unreachable from inside the harness container on 127.0.0.1.
#
# Assertion wiring (env.sh writes this):
#   Tinybird exposes a ClickHouse-compatible read-only interface on :7182
#   with HTTP basic auth (username=workspace_name, password=admin_token).
#   Friendly data-source names (`events`, `_seed_meta`, `_seed_spotchecks`)
#   live as views in a database named after the workspace (a long
#   Tinybird_Local_Build_<hash>). We resolve these at seed time and stash
#   them in /workspace/.tb-env so env.sh can build CLICKHOUSE_URL.
set -euo pipefail

# ----- Preconditions -----
command -v tb     >/dev/null 2>&1 || { echo "ERROR: tb CLI not on PATH"     >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker CLI not on PATH" >&2; exit 1; }
docker info >/dev/null 2>&1 || {
  echo "ERROR: docker socket unreachable. Expected /var/run/docker.sock mounted by runner." >&2
  exit 1
}

# ----- Scaffold project -----
mkdir -p /workspace/events-project/datasources
cd /workspace/events-project
cat > tinybird.config.json <<'EOF'
{
  "name": "events-project"
}
EOF

# Pre-migration ENGINE_SORTING_KEY is "event_ts, event_id". The agent's
# task is to change it to "event_type, event_ts, event_id".
cat > datasources/events.datasource <<'EOF'
SCHEMA >
    `event_id`   String `json:$.event_id`,
    `event_ts`   DateTime `json:$.event_ts`,
    `event_type` String `json:$.event_type`,
    `user_id`    String `json:$.user_id`

ENGINE "MergeTree"
ENGINE_SORTING_KEY "event_ts, event_id"
EOF

cat > datasources/_seed_meta.datasource <<'EOF'
SCHEMA >
    `key`   String `json:$.key`,
    `value` String `json:$.value`

ENGINE "MergeTree"
ENGINE_SORTING_KEY "key"
EOF

cat > datasources/_seed_spotchecks.datasource <<'EOF'
SCHEMA >
    `event_id`             String   `json:$.event_id`,
    `event_ts`             DateTime `json:$.event_ts`,
    `event_type`           String   `json:$.event_type`,
    `user_id`              String   `json:$.user_id`,
    `expected_session_id`  String   `json:$.expected_session_id`

ENGINE "MergeTree"
ENGINE_SORTING_KEY "event_id"
EOF

# ----- Bring up Tinybird Local -----
docker rm -f tb-local >/dev/null 2>&1 || true
docker volume rm tinybird-data >/dev/null 2>&1 || true
docker volume create tinybird-data >/dev/null

echo "seed: pulling tinybirdco/tinybird-local:latest (amd64; requires Rosetta on Apple Silicon)..."
docker pull --platform=linux/amd64 tinybirdco/tinybird-local:latest >/dev/null

echo "seed: starting Tinybird Local in harness netns ($HOSTNAME)..."
docker run -d \
  --name tb-local \
  --network="container:${HOSTNAME}" \
  -v tinybird-data:/var/lib/tinybird-server \
  --platform=linux/amd64 \
  tinybirdco/tinybird-local:latest >/dev/null

READY=0
for _ in $(seq 1 240); do
  if curl -fsS --max-time 2 "http://localhost:7182/v0/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "ERROR: Tinybird Local never became ready on :7182" >&2
  docker logs tb-local 2>&1 | tail -60 >&2
  exit 1
fi

# ----- Initial deploy -----
tb --local deploy 2>&1 | tee /tmp/tb-initial-deploy.log | tail -3
grep -qE "Deployment .* is live!|No changes" /tmp/tb-initial-deploy.log || {
  echo "ERROR: initial tb deploy did not succeed" >&2
  tail -40 /tmp/tb-initial-deploy.log >&2
  exit 1
}

# ----- Resolve workspace name + admin token -----
# `tb --local info` prints both. The workspace name is the ClickHouse
# database that exposes friendly data-source names; the token is the
# bearer for both the Events API (:7181) and the CH interface (:7182).
WORKSPACE=$(tb --local info 2>/dev/null | awk -F': ' '/^workspace_name:/ {print $2; exit}')
TB_ADMIN_TOKEN=$(tb --local info 2>/dev/null | awk -F': ' '/^token:/ {print $2; exit}')
if [[ -z "${WORKSPACE}" || -z "${TB_ADMIN_TOKEN}" ]]; then
  echo "ERROR: could not resolve workspace/token from 'tb --local info'" >&2
  tb --local info >&2 || true
  exit 1
fi

# ----- Generate deterministic 10k rows + append to events -----
# md5(n) as a stand-in for cityHash64 keeps the seed reproducible across
# runs without shelling into ClickHouse. The distribution is identical in
# shape to the other harnesses (5 event_types, ~500 users, 30-day span).
python3 <<'PY' > /tmp/events10k.ndjson
import hashlib, json
from datetime import datetime, timedelta
TYPES = ["pv", "click", "purchase", "signup", "logout"]
BASE = datetime(2026, 1, 1)
for n in range(10000):
    h  = int(hashlib.md5(str(n  ).encode()).hexdigest(), 16)
    h1 = int(hashlib.md5(str(n+1).encode()).hexdigest(), 16)
    h2 = int(hashlib.md5(str(n+2).encode()).hexdigest(), 16)
    ts = (BASE + timedelta(seconds=h % (30 * 86400))).strftime("%Y-%m-%dT%H:%M:%S")
    print(json.dumps({
        "event_id":   f"evt_{n+1:06d}",
        "event_ts":   ts,
        "event_type": TYPES[h1 % 5],
        "user_id":    f"usr_{(h2 % 500) + 1:04d}",
    }))
PY

echo "seed: appending 10k rows to events data source"
tb --local datasource append events --file /tmp/events10k.ndjson 2>&1 | tail -3

# Sanity: confirm row count before we compute anchors from it.
# GET with ?query=... works on :7182 — the URL param form is the spelling
# ClickHouse's HTTP handler recognizes. (Body-form for POST; URL-form for GET.)
TOTAL=$(curl -fsS -H "X-ClickHouse-Key: ${TB_ADMIN_TOKEN}" \
  "http://localhost:7182/?query=SELECT+count()+FROM+events+FORMAT+TabSeparated" | tr -d '[:space:]')
if [[ "${TOTAL}" != "10000" ]]; then
  echo "ERROR: seed row count mismatch — got '${TOTAL}', expected 10000" >&2
  exit 1
fi

# ----- Build _seed_meta NDJSON from live events -----
# Compute per-type counts via Tinybird's CH interface (SELECT-only — fine)
# and stream the result as NDJSON into `tb datasource append`.
#
# On :7182 we POST the SQL in the request body directly (NOT as a
# "query=<SQL>" form-encoded parameter). The ClickHouse HTTP parser sees
# the body literally; --data-urlencode "query=..." sends "query=..."
# which the parser then rejects as "Syntax error at position 1".
curl -fsS -H "X-ClickHouse-Key: ${TB_ADMIN_TOKEN}" \
  --data-binary @- \
  "http://localhost:7182/" > /tmp/seed_meta.ndjson <<'SQL'
SELECT key, value FROM (
  SELECT 'total_rows' AS key, toString(count()) AS value FROM events
  UNION ALL SELECT 'count_pv',       toString(countIf(event_type = 'pv'))       FROM events
  UNION ALL SELECT 'count_click',    toString(countIf(event_type = 'click'))    FROM events
  UNION ALL SELECT 'count_purchase', toString(countIf(event_type = 'purchase')) FROM events
  UNION ALL SELECT 'count_signup',   toString(countIf(event_type = 'signup'))   FROM events
  UNION ALL SELECT 'count_logout',   toString(countIf(event_type = 'logout'))   FROM events
) FORMAT JSONEachRow
SQL
wc -l /tmp/seed_meta.ndjson
tb --local datasource append _seed_meta --file /tmp/seed_meta.ndjson 2>&1 | tail -2

# ----- Build _seed_spotchecks NDJSON -----
# Five anchor rows by stable event_id, each with `expected_session_id`
# precomputed from the rule the agent's migration #2 backfill must apply.
# Assertions compare the agent's actual session_id against this expected.
curl -fsS -H "X-ClickHouse-Key: ${TB_ADMIN_TOKEN}" \
  --data-binary @- \
  "http://localhost:7182/" > /tmp/seed_spotchecks.ndjson <<'SQL'
-- CTE keeps `event_ts` a DateTime in the computation of expected_session_id;
-- without it, the outer alias `formatDateTime(...) AS event_ts` shadows the
-- original column before toStartOfDay() can consume it.
WITH base AS (
  SELECT event_id, event_ts, event_type, user_id,
         concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts)))) AS expected_session_id
  FROM events
  WHERE event_id IN ('evt_000001', 'evt_002500', 'evt_005000', 'evt_007500', 'evt_010000')
)
SELECT event_id,
       formatDateTime(event_ts, '%Y-%m-%dT%H:%i:%S') AS event_ts,
       event_type,
       user_id,
       expected_session_id
FROM base
FORMAT JSONEachRow
SQL
wc -l /tmp/seed_spotchecks.ndjson
tb --local datasource append _seed_spotchecks --file /tmp/seed_spotchecks.ndjson 2>&1 | tail -2

# ----- Publish wiring for env.sh + assertions -----
# env.sh reads this file on every lifecycle phase and exports CLICKHOUSE_URL
# with HTTP-basic auth baked in, so @clickhouse/client Just Works.
cat > /workspace/.tb-env <<EOF
TB_WORKSPACE=${WORKSPACE}
TB_ADMIN_TOKEN=${TB_ADMIN_TOKEN}
EOF
chmod 0600 /workspace/.tb-env

# ----- Stop tb-local (volume persists on host) -----
docker stop tb-local >/dev/null

# Confirm teardown: ports should be free.
if curl -fsS --max-time 2 "http://localhost:7182/v0/health" >/dev/null 2>&1; then
  echo "ERROR: port 7182 still responsive after docker stop tb-local" >&2
  exit 1
fi

echo "seed-workspace.sh (tinybird-forward): tb-local stopped, 10k rows + anchors persisted in volume tinybird-data"
echo "  workspace: ${WORKSPACE}"
echo "  agent restarts with: docker start tb-local"
