#!/usr/bin/env bash
# Seed the user-facing context the agent reads during the run.
# Two artifacts in /data:
#   user-need.md    — the user's natural-language goal (referenced by both prompts)
#   test_event.json — the smoke-test event used in post-deploy verification
#
# Template selection is NOT part of this scenario — DEPLOY_TEMPLATE is pinned in
# env.sh. The user-need is written to match what typescript-express exposes
# out of the box: a Foo ingest pipeline (id + timestamp + optional text) and a
# /api/bar aggregated read path.

set -euo pipefail

mkdir -p /data

cat > /data/user-need.md <<'EOF'
# What I want

I'm running a small product where I want to track events and look at simple
roll-ups in production. I just want a working URL — I don't want to manage
ClickHouse or Kubernetes myself.

Each event I'll send has these fields:

- `primaryKey` (string, unique per event)
- `timestamp` (Unix timestamp, seconds)
- `optionalText` (string, optional — free-form payload for some events)

I need:

- An HTTP endpoint I can POST events to.
- An HTTP endpoint I can GET aggregated counts back from (e.g. how many
  events landed today).
- A health endpoint so I can wire up an uptime check later.

Get me a production URL where this works.
EOF

cat > /data/test_event.json <<'EOF'
{
  "primaryKey": "smoke-bootstrap-001",
  "timestamp": 1745870400,
  "optionalText": "dec-bench production-bootstrap smoke event"
}
EOF

chmod 644 /data/user-need.md /data/test_event.json
