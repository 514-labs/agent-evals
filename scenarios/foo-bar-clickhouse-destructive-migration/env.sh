#!/usr/bin/env bash
# Sourced by docker/base/entrypoint.sh before every lifecycle phase.
# Keep this side-effect free: exports only, no network calls, no waits.

case "${EVAL_HARNESS:-}" in
  moose-legacy-migrations|moose-delta-migrations)
    export CLICKHOUSE_URL="http://panda:pandapass@localhost:18123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="18123"
    export CLICKHOUSE_USER="panda"
    export CLICKHOUSE_PASSWORD="pandapass"
    # Moose's typescript-empty template defaults db_name="local" — the
    # OlapTable<Event> defined in seed-workspace.sh materializes as local.events.
    export EVENTS_DATABASE="local"
    ;;
  tinybird-forward)
    # Tinybird Local runs as a sibling Docker container (spawned by the
    # seed via the mounted host docker.sock) sharing this container's
    # network namespace. Ports bound on 127.0.0.1: 7181 (Tinybird API),
    # 7182 (Tinybird ClickHouse HTTP interface — read-only), plus the
    # underlying CH on 8123/9000 (not user-supported).
    #
    # Tinybird exposes our friendly data-source names (`events`, etc.) as
    # views in a workspace-scoped database whose name is a hash-derived
    # `Tinybird_Local_Build_<sha>`. The seed resolves that name + the admin
    # token and stashes them in /workspace/.tb-env; we source and bake
    # them into CLICKHOUSE_URL as HTTP-basic auth (username=workspace,
    # password=token) so @clickhouse/client connects without extra glue.
    if [[ -r /workspace/.tb-env ]]; then
      # shellcheck disable=SC1091
      source /workspace/.tb-env
      # URL encodes HTTP-basic auth only; do NOT put the workspace in the
      # path — Tinybird's :7182 handler treats /<anything>/?query=... as a
      # resource path and 404s. Assertions already qualify tables as
      # `<database>.<table>`, so the "default database" via URL path is
      # unnecessary.
      export CLICKHOUSE_URL="http://${TB_WORKSPACE}:${TB_ADMIN_TOKEN}@localhost:7182"
      export CLICKHOUSE_HOST="localhost"
      export CLICKHOUSE_PORT="7182"
      export EVENTS_DATABASE="${TB_WORKSPACE}"
      export TB_WORKSPACE TB_ADMIN_TOKEN
    else
      # Pre-seed phase (init hasn't run yet). Provide sensible defaults
      # so tools that check env-var presence don't trip before seed.
      export CLICKHOUSE_URL="http://localhost:7182"
      export CLICKHOUSE_HOST="localhost"
      export CLICKHOUSE_PORT="7182"
      export EVENTS_DATABASE="default"
    fi
    ;;
  atlas-clickhouse)
    # Primary ClickHouse (8123/9000) carries seeded analytics.events + anchors;
    # the agent brings it back up from the persisted /var/lib/clickhouse.
    export CLICKHOUSE_URL="http://localhost:8123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="8123"
    export EVENTS_DATABASE="analytics"
    # Dev ClickHouse (8124/9001) is pre-started and left running by the seed
    # init. Atlas's schema/migrate commands require a live dev database to
    # compute diffs against — point --dev-url here.
    export CLICKHOUSE_DEV_URL="clickhouse://default@localhost:9001/_atlas_dev"
    export CLICKHOUSE_DEV_HTTP_URL="http://localhost:8124"
    export CLICKHOUSE_DEV_HOST="localhost"
    export CLICKHOUSE_DEV_PORT="9001"
    ;;
  *)
    export CLICKHOUSE_URL="http://localhost:8123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="8123"
    # Flat init/01-clickhouse-setup.sql seeds analytics.events.
    export EVENTS_DATABASE="analytics"
    ;;
esac
