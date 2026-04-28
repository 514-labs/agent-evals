#!/usr/bin/env bash
# Per-harness init for tinybird-forward on foo-bar-mv-access-patterns.
# Brings up Tinybird Local as a sibling Docker container sharing the
# harness container's network namespace (so the `tb` CLI's hard-coded
# 127.0.0.1:7182 resolves), scaffolds the Tinybird project, deploys the
# base `user_activity` data source, and appends the 10 seed rows from
# /data/samples/user_activity_sample.csv. Stops the Tinybird Local
# container at the end but leaves its volume intact so the agent can
# `docker start tb-local` and inherit the state.
#
# Why docker-run-direct and not `tb local start`:
#   `tb local start` spawns a Docker container with default flags — no
#   way to ask it to share the harness container's netns. Without that,
#   the Tinybird Local container's ports would bind on the host and be
#   unreachable from inside the harness container on 127.0.0.1.
#
# Assertion wiring (env.sh writes CLICKHOUSE_URL):
#   Tinybird exposes a ClickHouse-compatible read-only interface on
#   :7182 with HTTP basic auth (username=workspace_name, password=
#   admin_token). Friendly data-source names live as views in a database
#   named after the workspace. We resolve these at seed time and stash
#   them in /workspace/.tb-env so env.sh can build CLICKHOUSE_URL.
set -euo pipefail

# ----- Preconditions -----
command -v tb     >/dev/null 2>&1 || { echo "ERROR: tb CLI not on PATH"     >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker CLI not on PATH" >&2; exit 1; }
docker info >/dev/null 2>&1 || {
  echo "ERROR: docker socket unreachable. Expected /var/run/docker.sock mounted by runner." >&2
  exit 1
}
[[ -r /data/samples/user_activity_sample.csv ]] || {
  echo "ERROR: /data/samples/user_activity_sample.csv missing. Did /scenario/init/setup-sample-data.sh run?" >&2
  exit 1
}

# ----- Scaffold project -----
mkdir -p /workspace/user-activity-project/datasources
cd /workspace/user-activity-project
cat > tinybird.config.json <<'EOF'
{
  "name": "user-activity-project"
}
EOF

# duration_ms is Nullable so the CSV's one empty-field row (evt_004)
# ingests cleanly instead of quarantining. SUM(duration_ms) ignores
# NULLs, which matches ClickHouse's standard null arithmetic and keeps
# the assertion contract the same as on other harnesses.
cat > datasources/user_activity.datasource <<'EOF'
SCHEMA >
    `event_id`    String,
    `event_ts`    DateTime,
    `user_id`     String,
    `action`      String,
    `duration_ms` Nullable(UInt32)

ENGINE "MergeTree"
ENGINE_SORTING_KEY "user_id, event_ts"
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
WORKSPACE=$(tb --local info 2>/dev/null | awk -F': ' '/^workspace_name:/ {print $2; exit}')
TB_ADMIN_TOKEN=$(tb --local info 2>/dev/null | awk -F': ' '/^token:/ {print $2; exit}')
if [[ -z "${WORKSPACE}" || -z "${TB_ADMIN_TOKEN}" ]]; then
  echo "ERROR: could not resolve workspace/token from 'tb --local info'" >&2
  tb --local info >&2 || true
  exit 1
fi

# ----- Append CSV via tb datasource append -----
echo "seed: appending rows from user_activity_sample.csv"
tb --local datasource append user_activity --file /data/samples/user_activity_sample.csv 2>&1 | tail -5

# Sanity: confirm row count. GET with ?query=... works on :7182 — the
# URL-param form is the spelling ClickHouse's HTTP handler recognizes.
TOTAL=$(curl -fsS -H "X-ClickHouse-Key: ${TB_ADMIN_TOKEN}" \
  "http://localhost:7182/?query=SELECT+count()+FROM+user_activity+FORMAT+TabSeparated" | tr -d '[:space:]')
if [[ "${TOTAL}" != "10" ]]; then
  echo "ERROR: seed row count mismatch — got '${TOTAL}', expected 10" >&2
  exit 1
fi

# ----- Publish wiring for env.sh -----
cat > /workspace/.tb-env <<EOF
TB_WORKSPACE=${WORKSPACE}
TB_ADMIN_TOKEN=${TB_ADMIN_TOKEN}
EOF
chmod 0600 /workspace/.tb-env

# ----- Stop tb-local (volume persists on host) -----
docker stop tb-local >/dev/null

# Confirm teardown: port should be free.
if curl -fsS --max-time 2 "http://localhost:7182/v0/health" >/dev/null 2>&1; then
  echo "ERROR: port 7182 still responsive after docker stop tb-local" >&2
  exit 1
fi

echo "seed-workspace.sh (tinybird-forward): tb-local stopped, 10 rows persisted in volume tinybird-data"
echo "  workspace: ${WORKSPACE}"
echo "  agent restarts with: docker start tb-local"
