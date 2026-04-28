#!/usr/bin/env bash
# Per-harness env for tinybird-forward on foo-bar-csv-ingest.
# Sourced by docker/base/entrypoint.sh AFTER /scenario/env.sh on every
# lifecycle phase. Keep side-effect free: exports only.
#
# MUST be idempotent across two source passes with different filesystem
# state. The first pass runs before init (when /workspace/.tb-env does
# not exist yet); the second runs after the agent exits. Guard the
# .tb-env source with `if [[ -r ... ]]` so the first-pass defaults still
# allow tooling that checks env-var presence to work.

if [[ -r /workspace/.tb-env ]]; then
  # shellcheck disable=SC1091
  source /workspace/.tb-env
  export CLICKHOUSE_URL="http://${TB_WORKSPACE}:${TB_ADMIN_TOKEN}@localhost:7182"
  export CLICKHOUSE_HOST="localhost"
  export CLICKHOUSE_PORT="7182"
  export EVENTS_DATABASE="${TB_WORKSPACE}"
  export TB_WORKSPACE TB_ADMIN_TOKEN
else
  export CLICKHOUSE_URL="http://localhost:7182"
  export CLICKHOUSE_HOST="localhost"
  export CLICKHOUSE_PORT="7182"
  export EVENTS_DATABASE="default"
fi
