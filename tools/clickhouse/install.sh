#!/usr/bin/env bash
# Pre-download the ClickHouse binary into the cache directory `moose dev
# --dockerless` probes, so the first run doesn't need to hit the network.
set -euo pipefail

VERSION="${1:?usage: install.sh <version>}"

ver_lts="${VERSION}-lts"

arch="$(uname -m)"
case "$arch" in
  aarch64|arm64) ch_arch="arm64"; platform="linux-arm64" ;;
  x86_64|amd64)  ch_arch="amd64"; platform="linux-amd64" ;;
  *) echo "[install:clickhouse] unsupported arch: $arch" >&2; exit 1 ;;
esac

cache_dir="$HOME/.moose/binaries/clickhouse/${ver_lts}/${platform}"
mkdir -p "$cache_dir"

curl -fSL "https://github.com/ClickHouse/ClickHouse/releases/download/v${ver_lts}/clickhouse-common-static-${VERSION}-${ch_arch}.tgz" \
  | tar xz -C "$cache_dir"
chmod +x "${cache_dir}/clickhouse-common-static-${VERSION}/usr/bin/clickhouse"

echo "[install:clickhouse] pre-cached ClickHouse ${ver_lts} at ${cache_dir}"
