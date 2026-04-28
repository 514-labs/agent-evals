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
  *)
    export CLICKHOUSE_URL="http://localhost:8123"
    export CLICKHOUSE_HOST="localhost"
    export CLICKHOUSE_PORT="8123"
    # Flat init/01-clickhouse-setup.sql seeds analytics.events.
    export EVENTS_DATABASE="analytics"
    ;;
esac
