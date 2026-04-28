#!/usr/bin/env bash
set -euo pipefail

# Hands off to the deterministic Python generator that writes the full
# realistic-mid-scale S3-style export. ClickHouse must already be up
# (entrypoint.sh waits for it before running init scripts) because the
# generator shells out to clickhouse-client to render Parquet files.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "${SCRIPT_DIR}/generate-orders.py"

chmod -R a+rX /data/s3
