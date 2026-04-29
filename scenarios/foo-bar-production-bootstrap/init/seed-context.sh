#!/usr/bin/env bash
# Seed the runtime-only assets the agent needs in /data/. Today that's just:
#   test_event.json — the smoke-test event used in post-deploy verification

set -euo pipefail

mkdir -p /data

SMOKE_EVENT_TIMESTAMP="$(date -u +%s)"

cat > /data/test_event.json <<EOF
{
  "primaryKey": "smoke-bootstrap-001",
  "timestamp": ${SMOKE_EVENT_TIMESTAMP},
  "optionalText": "dec-bench production-bootstrap smoke event"
}
EOF

chmod 644 /data/test_event.json
