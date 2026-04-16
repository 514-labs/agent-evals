#!/usr/bin/env bash

# Default ClickHouse connection for direct-access personas (baseline, informed).
# Moose overrides these when running on port 18123 with auth — the entrypoint
# recovery function detects the running instance and redirects automatically.
export CLICKHOUSE_URL="http://localhost:8123"
export CLICKHOUSE_HOST="localhost"
export CLICKHOUSE_PORT="8123"
