#!/usr/bin/env bash
set -euo pipefail

# Run all scenarios across non-Anthropic agents (codex, cursor).
# Anthropic agents (claude-code) can be added to AGENTS below.
#
# Usage:
#   ./scripts/run-all-agents.sh                  # build + run all
#   ./scripts/run-all-agents.sh --dry-run        # print what would run
#   ./scripts/run-all-agents.sh --run-only       # skip build step
#   ./scripts/run-all-agents.sh --build-only     # build images only
#   ./scripts/run-all-agents.sh --agent=cursor   # only run cursor agent
#   ./scripts/run-all-agents.sh --scenario=foo-bar-csv-ingest  # only run one scenario

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCENARIOS_DIR="${REPO_ROOT}/scenarios"
RESULTS_DIR="${REPO_ROOT}/results"

DRY_RUN=false
RUN_ONLY=false
BUILD_ONLY=false
LIMIT=0  # 0 = no limit
FILTER_AGENT=""
FILTER_SCENARIO=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --run-only)     RUN_ONLY=true ;;
    --build-only)   BUILD_ONLY=true ;;
    --limit=*)      LIMIT="${arg#--limit=}" ;;
    --agent=*)      FILTER_AGENT="${arg#--agent=}" ;;
    --scenario=*)   FILTER_SCENARIO="${arg#--scenario=}" ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# --- Agent definitions ---
# Format: agent_id:model_slug:required_env_key
AGENTS=(
  "codex:gpt-5.4:OPENAI_API_KEY"
  "cursor:composer-2:CURSOR_API_KEY"
)

# Uncomment to include Anthropic agents:
# AGENTS+=(
#   "claude-code:claude-sonnet-4-6:ANTHROPIC_API_KEY"
#   "claude-code:claude-opus-4-6:ANTHROPIC_API_KEY"
# )

# --- Collect scenarios with harness from scenario.json ---
scenarios=()
harnesses=()
for scenario_dir in "${SCENARIOS_DIR}"/*/; do
  scenario_json="${scenario_dir}scenario.json"
  [[ -f "$scenario_json" ]] || continue
  id=$(python3 -c "import json; print(json.load(open('${scenario_json}'))['id'])")
  harness=$(python3 -c "import json; print(json.load(open('${scenario_json}')).get('harness', 'base-rt'))")
  scenarios+=("$id")
  harnesses+=("$harness")
done

echo "Found ${#scenarios[@]} scenarios, ${#AGENTS[@]} agents"
echo ""

# --- Preflight: check API keys ---
missing_keys=()
for agent_spec in "${AGENTS[@]}"; do
  IFS=: read -r agent_id model_slug env_key <<< "$agent_spec"
  if [[ -z "${!env_key:-}" ]]; then
    missing_keys+=("$env_key (for $agent_id)")
  fi
done

if [[ ${#missing_keys[@]} -gt 0 ]]; then
  echo "ERROR: Missing API keys:"
  for key in "${missing_keys[@]}"; do
    echo "  - $key"
  done
  echo ""
  echo "Set them in your environment and retry."
  exit 1
fi

# --- Main loop ---
total=0
failed=0
skipped=0

for i in "${!scenarios[@]}"; do
  scenario="${scenarios[$i]}"
  harness="${harnesses[$i]}"

  if [[ -n "$FILTER_SCENARIO" && "$scenario" != "$FILTER_SCENARIO" ]]; then
    continue
  fi

  for agent_spec in "${AGENTS[@]}"; do
    IFS=: read -r agent_id model_slug env_key <<< "$agent_spec"
    if [[ -n "$FILTER_AGENT" && "$agent_id" != "$FILTER_AGENT" ]]; then
      continue
    fi
    if [[ "$LIMIT" -gt 0 && "$total" -ge "$LIMIT" ]]; then
      echo "  [limit reached] stopping at $LIMIT runs"
      break 2
    fi

    total=$((total + 1))
    image_tag="${scenario}.${harness}.${agent_id}.${model_slug}.v0.1.0"

    echo "────────────────────────────────────────────────────────"
    echo "[$total] scenario=$scenario  harness=$harness  agent=$agent_id  model=$model_slug"
    echo "  image=$image_tag"

    if $DRY_RUN; then
      echo "  [dry-run] would build + run"
      continue
    fi

    # Build
    if ! $RUN_ONLY; then
      echo "  Building..."
      if ! cargo run --bin dec-bench -- build \
        --scenario "$scenario" \
        --harness "$harness" \
        --agent "$agent_id" \
        --model "$model_slug" 2>&1; then
        echo "  BUILD FAILED — skipping run"
        failed=$((failed + 1))
        continue
      fi
    fi

    if $BUILD_ONLY; then
      continue
    fi

    # Run
    echo "  Running..."
    if ! cargo run --bin dec-bench -- run \
      --scenario "$scenario" \
      --harness "$harness" \
      --agent "$agent_id" \
      --model "$model_slug" \
      --results-dir "$RESULTS_DIR" 2>&1; then
      echo "  RUN FAILED"
      failed=$((failed + 1))
    fi
  done
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "Done. Total=$total  Failed=$failed"
