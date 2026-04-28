#!/usr/bin/env bash
# base-rt seed: target the supervised ClickHouse on the default ports
# (HTTP 8123, TCP 9000, no auth) and run the shared seed library.
set -eu

export CH_HOST="localhost"
export CH_TCP_PORT="9000"
export CH_HTTP_URL="http://localhost:8123"

exec /scenario/_lib/seed.sh
