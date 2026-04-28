#!/usr/bin/env bash
# Per-harness init for tinybird-forward on foo-bar-csv-ingest.
# Brings up Tinybird Local in the harness container's network namespace,
# bootstraps an empty workspace (so a token can be resolved), then stops
# tb-local with the volume persisted. Agent task: write an `events`
# data source, clean the messy CSVs, append into Tinybird. The messy
# CSVs are set up by /scenario/init/setup-csvs.sh at /data/csv/.
set -euo pipefail

command -v tb     >/dev/null 2>&1 || { echo "ERROR: tb CLI not on PATH"     >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker CLI not on PATH" >&2; exit 1; }
docker info >/dev/null 2>&1 || {
  echo "ERROR: docker socket unreachable. Expected /var/run/docker.sock mounted by runner." >&2
  exit 1
}
[[ -d /data/csv ]] || {
  echo "ERROR: /data/csv/ missing. Did /scenario/init/setup-csvs.sh run?" >&2
  exit 1
}

mkdir -p /workspace/events-project/datasources
cd /workspace/events-project
cat > tinybird.config.json <<'EOF'
{
  "name": "events-project"
}
EOF

cat > datasources/_bootstrap.datasource <<'EOF'
SCHEMA >
    `key`   String,
    `value` String

ENGINE "MergeTree"
ENGINE_SORTING_KEY "key"
EOF

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

tb --local deploy 2>&1 | tee /tmp/tb-initial-deploy.log | tail -3
grep -qE "Deployment .* is live!|No changes" /tmp/tb-initial-deploy.log || {
  echo "ERROR: initial tb deploy did not succeed" >&2
  tail -40 /tmp/tb-initial-deploy.log >&2
  exit 1
}

WORKSPACE=$(tb --local info 2>/dev/null | awk -F': ' '/^workspace_name:/ {print $2; exit}')
TB_ADMIN_TOKEN=$(tb --local info 2>/dev/null | awk -F': ' '/^token:/ {print $2; exit}')
if [[ -z "${WORKSPACE}" || -z "${TB_ADMIN_TOKEN}" ]]; then
  echo "ERROR: could not resolve workspace/token from 'tb --local info'" >&2
  tb --local info >&2 || true
  exit 1
fi

cat > /workspace/.tb-env <<EOF
TB_WORKSPACE=${WORKSPACE}
TB_ADMIN_TOKEN=${TB_ADMIN_TOKEN}
EOF
chmod 0600 /workspace/.tb-env

docker stop tb-local >/dev/null
if curl -fsS --max-time 2 "http://localhost:7182/v0/health" >/dev/null 2>&1; then
  echo "ERROR: port 7182 still responsive after docker stop tb-local" >&2
  exit 1
fi

echo "seed-workspace.sh (tinybird-forward): tb-local stopped, empty workspace bootstrapped"
echo "  workspace: ${WORKSPACE}"
echo "  agent restarts with: docker start tb-local"
