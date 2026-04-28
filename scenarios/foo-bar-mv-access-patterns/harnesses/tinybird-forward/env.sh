#!/usr/bin/env bash
# Per-harness env for tinybird-forward on foo-bar-mv-access-patterns.
# Sourced by docker/base/entrypoint.sh AFTER /scenario/env.sh on every
# lifecycle phase. Keep this side-effect free: exports only, no network,
# no waits.
#
# MUST be idempotent across two source passes with different filesystem
# state: the first pass runs before init (when /workspace/.tb-env does
# not exist yet) and the second runs after the agent (when it does).
# Guard the .tb-env source with `if [[ -r ... ]]` and fall back to
# sensible defaults on the first pass.
#
# Tinybird Local runs as a sibling Docker container (spawned by init
# via the mounted host docker.sock) sharing this container's network
# namespace. Ports bound on 127.0.0.1:
#   7181 — Tinybird API (Events API for ingest, Pipes API for egress)
#   7182 — Tinybird ClickHouse HTTP interface (SELECT/DESCRIBE only)
#
# Tinybird exposes our friendly data-source names (`user_activity` and
# any MV target data sources the agent creates) as views in a workspace-
# scoped database whose name is a hash-derived `Tinybird_Local_Build_<sha>`.
# Init resolves that workspace name + the admin token and stashes them
# in /workspace/.tb-env; we bake them into CLICKHOUSE_URL as HTTP-basic
# auth (username=workspace, password=token) so @clickhouse/client connects
# without extra glue.

if [[ -r /workspace/.tb-env ]]; then
  # shellcheck disable=SC1091
  source /workspace/.tb-env
  # URL encodes HTTP-basic auth only; do NOT put the workspace in the
  # path — Tinybird's :7182 handler treats /<anything>/?query=... as a
  # resource path and 404s. Assertions qualify tables as
  # `<database>.<table>`, so the "default database" via URL path is
  # unnecessary.
  export CLICKHOUSE_URL="http://${TB_WORKSPACE}:${TB_ADMIN_TOKEN}@localhost:7182"
  export CLICKHOUSE_HOST="localhost"
  export CLICKHOUSE_PORT="7182"
  export EVENTS_DATABASE="${TB_WORKSPACE}"
  export TB_WORKSPACE TB_ADMIN_TOKEN
else
  # Pre-seed phase (init hasn't run yet). Provide sensible defaults so
  # tools that check env-var presence don't trip before seed.
  export CLICKHOUSE_URL="http://localhost:7182"
  export CLICKHOUSE_HOST="localhost"
  export CLICKHOUSE_PORT="7182"
  export EVENTS_DATABASE="default"
fi
