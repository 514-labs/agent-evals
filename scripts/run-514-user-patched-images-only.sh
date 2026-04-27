#!/usr/bin/env bash
# Run-only variant of run-514-user-patched.sh. Assumes the
# `v0.2.0-patched` images for every scenarios/514-* already exist (e.g.
# from a prior build run that didn't need cache) and fires scenarios ×
# personas at concurrency 2.
set -euo pipefail

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

# Fail fast if any patched image is missing — this script deliberately does
# not rebuild.
for scn in "${SCENARIOS[@]}"; do
  tag="${scn}.${HARNESS}.claude-code.claude-sonnet-4-20250514.${VERSION}"
  if ! docker image inspect "$tag" >/dev/null 2>&1; then
    echo "Missing image: $tag" >&2
    echo "Build first with scripts/run-514-user-patched.sh" >&2
    exit 1
  fi
done

echo "== Running scenarios × personas (concurrency=2) =="
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
