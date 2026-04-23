#!/usr/bin/env bash
# Per-harness init for tinybird-forward on foo-bar-create-analytics-table.
# Brings up Tinybird Local as a sibling Docker container sharing the
# harness container's network namespace, bootstraps an empty workspace
# so a token can be resolved, then stops tb-local with the volume
# persisted. The agent defines the `user_activity` data source schema
# themselves — that IS the task (mirrors the Moose variant where the
# agent defines the data model).
#
# Why a bootstrap `_bootstrap.datasource`: `tb --local info` only prints
# `workspace_name:` and `token:` AFTER the workspace has at least one
# deployed resource. The bootstrap table is clearly labeled meta
# (key/value) and the informed prompt tells the agent they can leave
# it or remove it — it's not part of the scoring contract.
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

# Bootstrap-only data source to establish the workspace. Agent is free
# to remove it — only `user_activity` (which the agent creates) is
# covered by assertions.
cat > datasources/_bootstrap.datasource <<'EOF'
SCHEMA >
    `key`   String,
    `value` String

ENGINE "MergeTree"
ENGINE_SORTING_KEY "key"
EOF

# ----- Bring up Tinybird Local -----
docker rm -f tb-local >/dev/null 2>&1 || true
docker volume rm tinybird-data >/dev/null 2>&1 || true
docker volume create tinybird-data >/dev/null

echo "seed: pulling tinybirdco/tinybird-local:latest..."
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

# ----- Initial deploy (bootstrap only) -----
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

# ----- Publish wiring for env.sh -----
cat > /workspace/.tb-env <<EOF
TB_WORKSPACE=${WORKSPACE}
TB_ADMIN_TOKEN=${TB_ADMIN_TOKEN}
EOF
chmod 0600 /workspace/.tb-env

# ----- Stop tb-local (volume persists) -----
docker stop tb-local >/dev/null

if curl -fsS --max-time 2 "http://localhost:7182/v0/health" >/dev/null 2>&1; then
  echo "ERROR: port 7182 still responsive after docker stop tb-local" >&2
  exit 1
fi

echo "seed-workspace.sh (tinybird-forward): tb-local stopped, empty workspace bootstrapped"
echo "  workspace: ${WORKSPACE}"
echo "  agent restarts with: docker start tb-local"
