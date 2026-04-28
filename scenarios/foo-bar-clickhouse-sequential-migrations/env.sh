#!/usr/bin/env bash
# Sourced by docker/base/entrypoint.sh before every lifecycle phase.
# Re-sourced once more before assertions so tinybird-forward can pick up
# the workspace + token its seed stashed in /workspace/.tb-env.
# Keep this side-effect free: exports only, no network calls, no waits.

case "${EVAL_HARNESS:-}" in
  moose-legacy-migrations|moose-delta-migrations)
    export CLICKHOUSE_URL="http://panda:pandapass@localhost:18123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="18123"
    export CLICKHOUSE_USER="panda"
    export CLICKHOUSE_PASSWORD="pandapass"
    # Moose's typescript-empty template defaults db_name="local".
    export EVENTS_DATABASE="local"
    ;;
  atlas-clickhouse)
    # Primary ClickHouse on 8123 carries seeded analytics.events + anchors.
    # Dev ClickHouse on 8124/9001 provides Atlas's --dev-url.
    export CLICKHOUSE_URL="http://localhost:8123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="8123"
    export EVENTS_DATABASE="analytics"
    export CLICKHOUSE_DEV_URL="clickhouse://default@localhost:9001/_atlas_dev"
    export CLICKHOUSE_DEV_HTTP_URL="http://localhost:8124"
    export CLICKHOUSE_DEV_HOST="localhost"
    export CLICKHOUSE_DEV_PORT="9001"
    ;;
  tinybird-forward)
    # Tinybird Local is a sibling container sharing the harness's network
    # namespace. Assertions query its read-only ClickHouse HTTP interface
    # on :7182 with HTTP-basic auth (username=workspace, password=token),
    # resolved at seed time into /workspace/.tb-env and re-sourced here.
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
    ;;
  *)
    export CLICKHOUSE_URL="http://localhost:8123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="8123"
    export EVENTS_DATABASE="analytics"
    ;;
esac
