#!/usr/bin/env bash
# Replace every cached ClickHouse binary with a local build.
set -euo pipefail

SRC="${1:?usage: override.sh <source-binary>}"

if [[ ! -f "$SRC" ]]; then
  echo "[override:clickhouse] source binary not found: $SRC" >&2
  exit 1
fi
chmod +x "$SRC"

count=0
shopt -s nullglob
for ch_bin in "$HOME/.moose/binaries/clickhouse/"*/*/clickhouse-common-static-*/usr/bin/clickhouse; do
  cp "$SRC" "$ch_bin"
  chmod +x "$ch_bin"
  count=$((count + 1))
done

if (( count == 0 )); then
  echo "[override:clickhouse] no cached ClickHouse binaries found — nothing replaced" >&2
  exit 1
fi

echo "[override:clickhouse] replaced ${count} cached ClickHouse binary/binaries"
