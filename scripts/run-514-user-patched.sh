#!/usr/bin/env bash
# Build + run every scenarios/514-* scenario against a local patched 514 CLI
# binary. Produces result files under results/ tagged with
# version=v0.2.0-patched so they don't collide with baseline runs.
#
# Usage: scripts/run-514-user-patched.sh <path-to-linux-514-binary>
#
# The binary must be a Linux executable matching the container arch
# (aarch64-unknown-linux-gnu on Apple Silicon hosts, x86_64-unknown-linux-gnu
# on Intel/Linux hosts). Auth for the 514 CLI inside the container is
# forwarded from the host env — HOSTING_CLI_API_KEY must be set before
# invoking this script (see scenarios/514-list-projects/init/setup-514-auth.sh).
set -euo pipefail

USAGE="usage: run-514-user-patched.sh <linux-514-binary>"
CLI_BIN="${1:?${USAGE}}"

if [[ ! -x "$CLI_BIN" ]]; then
  echo "Not executable: $CLI_BIN" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

SCENARIOS=()
while IFS= read -r dir; do
  SCENARIOS+=("$(basename "$dir")")
done < <(find scenarios -mindepth 1 -maxdepth 1 -type d -name '514-*' | sort)

if (( ${#SCENARIOS[@]} == 0 )); then
  echo "No scenarios/514-* directories found" >&2
  exit 1
fi

VERSION="v0.2.0-patched"
HARNESS="olap-for-swe"
PERSONAS=(baseline informed)

DEC="./target/debug/dec-bench"

echo "== Building patched images (${#SCENARIOS[@]} scenarios) =="
for scn in "${SCENARIOS[@]}"; do
  echo "--- build: $scn ---"
  "$DEC" build \
    --scenario "$scn" \
    --harness "$HARNESS" \
    --version "$VERSION" \
    --override "514=${CLI_BIN}"
done

echo
echo "== Running scenarios × personas (concurrency=2) =="
# Emit "<scenario>|<persona>" lines and split on the pipe inside the worker.
jobs=()
for scn in "${SCENARIOS[@]}"; do
  for persona in "${PERSONAS[@]}"; do
    jobs+=("${scn}|${persona}")
  done
done

printf '%s\n' "${jobs[@]}" | xargs -n 1 -P 2 -I {} bash -c '
  IFS="|" read -r scn persona <<< "$1"
  "$0" run \
    --scenario "$scn" \
    --harness "'"$HARNESS"'" \
    --persona "$persona" \
    --mode no-plan \
    --version "'"$VERSION"'" \
    --timeout 20
' "$DEC" {}
