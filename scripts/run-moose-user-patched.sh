#!/usr/bin/env bash
# Build + run the S1–S5 moose-user scenarios against a local patched
# moose-cli binary + its packaged templates. Produces result files under
# results/ tagged with version=v0.2.0-patched so they don't collide with
# baseline runs.
#
# Usage: scripts/run-moose-user-patched.sh \
#          <path-to-linux-moose-binary> \
#          <path-to-template-packages-dir>
#
# The templates dir must contain manifest.toml + *.tgz as produced by
# moose-0's scripts/package-templates.js. The dev-build moose-cli
# (CLI_VERSION == "0.0.1") resolves templates from /usr/template-packages/
# inside the image, which the moose-templates override stages.
set -euo pipefail

USAGE="usage: run-moose-user-patched.sh <linux-moose-binary> <templates-dir> <moose-lib-tgz>"
MOOSE_BIN="${1:?${USAGE}}"
TEMPLATES_DIR="${2:?${USAGE}}"
MOOSE_LIB_TGZ="${3:?${USAGE}}"

if [[ ! -x "$MOOSE_BIN" ]]; then
  echo "Not executable: $MOOSE_BIN" >&2
  exit 1
fi
if [[ ! -f "$TEMPLATES_DIR/manifest.toml" ]]; then
  echo "Missing $TEMPLATES_DIR/manifest.toml — run 'node scripts/package-templates.js' in the moose repo first" >&2
  exit 1
fi
if [[ ! -f "$MOOSE_LIB_TGZ" ]]; then
  echo "Missing moose-lib tarball: $MOOSE_LIB_TGZ — run 'pnpm pack' in moose/packages/ts-moose-lib" >&2
  exit 1
fi

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

echo "== Building patched images =="
for scn in "${SCENARIOS[@]}"; do
  echo "--- build: $scn ---"
  "$DEC" build \
    --scenario "$scn" \
    --harness "$HARNESS" \
    --version "$VERSION" \
    --override "moose=${MOOSE_BIN}" \
    --override "moose-templates=${TEMPLATES_DIR}" \
    --override "moose-lib=${MOOSE_LIB_TGZ}"
done

echo
echo "== Running S1..S5 (olap-for-swe informed, concurrency=2) =="
# xargs gives portable -P 2 concurrency. Matrix mode would sweep all 22
# harness-compatible scenarios and also auto-rebuild missing images without
# the override, so we enumerate the 5 we care about explicitly.
printf '%s\n' "${SCENARIOS[@]}" | xargs -n 1 -P 2 -I {} \
  "$DEC" run \
    --scenario "{}" \
    --harness "$HARNESS" \
    --persona informed \
    --mode no-plan \
    --version "$VERSION" \
    --timeout 20
