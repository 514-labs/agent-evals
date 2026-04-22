#!/usr/bin/env bash
# Run-only variant of run-moose-user-patched.sh. Assumes the five
# `v0.2.0-patched` images already exist (e.g. from a prior build run that
# didn't need cache) and fires the scenarios at concurrency 2.
set -euo pipefail

SCENARIOS=(
  foo-bar-csv-ingest
  foo-bar-create-analytics-table
  foo-bar-ingest-to-api
  foo-bar-mv-access-patterns
  foo-bar-full-olap-pipeline
)

VERSION="v0.2.0-patched"
HARNESS="olap-for-swe"

cd "$(dirname "$0")/.."
DEC="./target/debug/dec-bench"

# Fail fast if any patched image is missing — this script deliberately does
# not rebuild.
for scn in "${SCENARIOS[@]}"; do
  tag="${scn}.${HARNESS}.claude-code.claude-sonnet-4-20250514.${VERSION}"
  if ! docker image inspect "$tag" >/dev/null 2>&1; then
    echo "Missing image: $tag" >&2
    echo "Build first with scripts/run-moose-user-patched.sh" >&2
    exit 1
  fi
done

echo "== Running S1..S5 (olap-for-swe informed, concurrency=2) =="
printf '%s\n' "${SCENARIOS[@]}" | xargs -n 1 -P 2 -I {} \
  "$DEC" run \
    --scenario "{}" \
    --harness "$HARNESS" \
    --persona informed \
    --mode no-plan \
    --version "$VERSION" \
    --timeout 20
