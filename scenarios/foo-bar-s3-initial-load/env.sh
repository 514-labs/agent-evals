#!/usr/bin/env bash

export CLICKHOUSE_URL="http://localhost:8123"
export CLICKHOUSE_HOST="localhost"
export CLICKHOUSE_PORT="8123"

export S3_ENDPOINT="file:///data/s3"
export S3_BUCKET="foo-bar-prod-exports"
export S3_PREFIX="initial-load/orders/2026-01/"
export S3_REGION="us-east-1"
export S3_ACCESS_KEY_ID="decbench-access-key"
export S3_SECRET_ACCESS_KEY="decbench-secret-key"
export S3_SESSION_TOKEN="decbench-session-token"
export S3_MANIFEST_PATH="/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01/manifest.csv"
