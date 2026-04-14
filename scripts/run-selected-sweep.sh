#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/.." && pwd)"
self_path="${script_dir}/$(basename -- "${BASH_SOURCE[0]}")"

default_agent_models=(
  "claude-code:claude-sonnet-4-20250514"
  "codex:gpt-5.4"
  "cursor:composer-2"
)

tier1_scenarios=(
  "foo-bar-csv-ingest"
  "foo-bar-clickhouse-orderby-optimization"
  "foo-bar-clickhouse-ttl-lifecycle"
  "foo-bar-derived-composite-metrics"
  "foo-bar-slow-analytical-api"
)

tier2_scenarios=(
  "foo-bar-analytics-api-concurrency"
  "foo-bar-clickhouse-live-schema-migration"
  "foo-bar-clickhouse-materialized-view"
  "foo-bar-paginated-analytics-api"
  "foo-bar-time-grain-rollups"
)

tier3_scenarios=(
  "foo-bar-cross-system-reconciliation"
  "foo-bar-event-sourcing-replay"
  "foo-bar-full-pipeline-debug"
  "foo-bar-oltp-to-olap-migration"
  "foo-bar-realtime-streaming-metrics"
)

canonical_rows=(
  "foo-bar-csv-ingest	base-rt"
  "foo-bar-clickhouse-orderby-optimization	base-rt"
  "foo-bar-clickhouse-ttl-lifecycle	base-rt"
  "foo-bar-derived-composite-metrics	base-rt"
  "foo-bar-slow-analytical-api	base-rt"
  "foo-bar-analytics-api-concurrency	classic-de"
  "foo-bar-clickhouse-live-schema-migration	classic-de"
  "foo-bar-clickhouse-materialized-view	classic-de"
  "foo-bar-paginated-analytics-api	classic-de"
  "foo-bar-time-grain-rollups	classic-de"
  "foo-bar-cross-system-reconciliation	classic-de"
  "foo-bar-event-sourcing-replay	classic-de"
  "foo-bar-full-pipeline-debug	classic-de"
  "foo-bar-oltp-to-olap-migration	classic-de"
  "foo-bar-realtime-streaming-metrics	classic-de"
)

print_usage() {
  cat <<'EOF'
Usage:
  scripts/run-selected-sweep.sh [options]

This runner exists because `dec-bench run --matrix` cannot express:
  1. an arbitrary 15-scenario subset, and
  2. harness overrides to `olap-for-swe`.

Defaults:
  - run target: olap-only
  - parallelism: 8
  - persona: informed
  - mode: no-plan
  - agent models:
      claude-code:claude-sonnet-4-20250514
      codex:gpt-5.4
      cursor:composer-2

Options:
  --run-target <olap-only|canonical|compare>
  --parallel <n>
  --persona <baseline|informed>
  --mode <plan|no-plan>
  --results-dir <dir>
  --version <v>
  --agent-model <agent:model>    Repeatable.
  --no-skip-existing
  --dry-run
  --list
  --help

Examples:
  scripts/run-selected-sweep.sh --dry-run
  scripts/run-selected-sweep.sh --parallel 8
  scripts/run-selected-sweep.sh --run-target compare --parallel 8
  scripts/run-selected-sweep.sh --agent-model claude-code:claude-opus-4-6 --parallel 8
EOF
}

print_selection() {
  printf 'Tier 1 (5)\n'
  for scenario in "${tier1_scenarios[@]}"; do
    printf '  %s\n' "${scenario}"
  done

  printf 'Tier 2 (5)\n'
  for scenario in "${tier2_scenarios[@]}"; do
    printf '  %s\n' "${scenario}"
  done

  printf 'Tier 3 (5)\n'
  for scenario in "${tier3_scenarios[@]}"; do
    printf '  %s\n' "${scenario}"
  done
}

scenario_exists() {
  local scenario="$1"
  [[ -f "${repo_root}/scenarios/${scenario}/scenario.json" ]]
}

validate_scenarios() {
  for row in "${canonical_rows[@]}"; do
    local scenario=""
    local harness=""
    IFS=$'\t' read -r scenario harness <<< "${row}"
    if ! scenario_exists "${scenario}"; then
      printf 'Missing scenario: %s\n' "${scenario}" >&2
      exit 1
    fi
  done
}

has_existing_result() {
  local results_dir="$1"
  local scenario="$2"
  local harness="$3"
  local agent="$4"
  local model="$5"
  local persona="$6"
  local mode="$7"

  [[ -d "${results_dir}" ]] || return 1

  local prefix="${scenario}-${agent}-${model}-${harness}-${persona}-${mode}-"
  find "${results_dir}" -maxdepth 1 -type f -name "${prefix}*.json" \
    ! -name "*.assertion-log.json" \
    ! -name "*.agent-raw.json" \
    ! -name "*.run-meta.json" \
    ! -name "*.trace.json" \
    ! -name "*.session.json" \
    ! -name "*.session.jsonl" \
    | grep -q .
}

run_one() {
  local results_dir="$1"
  local persona="$2"
  local mode="$3"
  local version="$4"
  local skip_existing="$5"
  local scenario="$6"
  local harness="$7"
  local agent="$8"
  local model="$9"

  if [[ "${skip_existing}" == "1" ]] && has_existing_result "${results_dir}" "${scenario}" "${harness}" "${agent}" "${model}" "${persona}" "${mode}"; then
    printf 'Skipping existing: scenario=%s harness=%s agent=%s model=%s\n' "${scenario}" "${harness}" "${agent}" "${model}"
    return 0
  fi

  printf 'Running: scenario=%s harness=%s agent=%s model=%s\n' "${scenario}" "${harness}" "${agent}" "${model}"

  (
    cd "${repo_root}"
    env PATH="/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH}" \
      ./target/debug/dec-bench run \
      --scenario "${scenario}" \
      --harness "${harness}" \
      --agent "${agent}" \
      --model "${model}" \
      --persona "${persona}" \
      --mode "${mode}" \
      --version "${version}" \
      --results-dir "${results_dir}"
  )
}

if [[ "${1:-}" == "--run-one" ]]; then
  shift
  run_one "$@"
  exit 0
fi

run_target="olap-only"
parallel="8"
persona="informed"
mode="no-plan"
version="v0.1.0"
skip_existing="1"
dry_run="0"
results_dir=""
agent_models=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-target)
      run_target="$2"
      shift 2
      ;;
    --parallel)
      parallel="$2"
      shift 2
      ;;
    --persona)
      persona="$2"
      shift 2
      ;;
    --mode)
      mode="$2"
      shift 2
      ;;
    --results-dir)
      results_dir="$2"
      shift 2
      ;;
    --version)
      version="$2"
      shift 2
      ;;
    --agent-model)
      agent_models+=("$2")
      shift 2
      ;;
    --no-skip-existing)
      skip_existing="0"
      shift
      ;;
    --dry-run)
      dry_run="1"
      shift
      ;;
    --list)
      print_selection
      exit 0
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

case "${run_target}" in
  olap-only|canonical|compare)
    ;;
  *)
    printf 'Invalid --run-target: %s\n' "${run_target}" >&2
    exit 1
    ;;
esac

if ! [[ "${parallel}" =~ ^[1-9][0-9]*$ ]]; then
  printf '--parallel must be a positive integer\n' >&2
  exit 1
fi

if [[ "${#agent_models[@]}" -eq 0 ]]; then
  agent_models=("${default_agent_models[@]}")
fi

for agent_model in "${agent_models[@]}"; do
  if [[ "${agent_model}" != *:* ]]; then
    printf 'Invalid agent model: %s\n' "${agent_model}" >&2
    exit 1
  fi
done

validate_scenarios

if [[ -z "${results_dir}" ]]; then
  stamp="$(date '+%Y%m%d-%H%M%S')"
  results_dir="results/selected-sweep-${run_target}-${stamp}"
fi

mkdir -p "${repo_root}/${results_dir}"

job_fields=()
for row in "${canonical_rows[@]}"; do
  scenario=""
  harness=""
  IFS=$'\t' read -r scenario harness <<< "${row}"
  for agent_model in "${agent_models[@]}"; do
    agent="${agent_model%%:*}"
    model="${agent_model#*:}"
    if [[ "${run_target}" == "canonical" || "${run_target}" == "compare" ]]; then
      job_fields+=("${scenario}" "${harness}" "${agent}" "${model}")
    fi
    if [[ "${run_target}" == "olap-only" || "${run_target}" == "compare" ]]; then
      job_fields+=("${scenario}" "olap-for-swe" "${agent}" "${model}")
    fi
  done
done

job_count=$(( ${#job_fields[@]} / 4 ))

printf 'Run target: %s\n' "${run_target}"
printf 'Parallelism: %s\n' "${parallel}"
printf 'Persona/mode: %s / %s\n' "${persona}" "${mode}"
printf 'Results dir: %s\n' "${results_dir}"
printf 'Agent models (%s)\n' "${#agent_models[@]}"
for agent_model in "${agent_models[@]}"; do
  printf '  %s\n' "${agent_model}"
done
printf 'Scenarios: 15\n'
printf 'Jobs: %s\n' "${job_count}"

if [[ "${dry_run}" == "1" ]]; then
  printf 'Dry run jobs:\n'
  index=0
  while [[ ${index} -lt ${#job_fields[@]} ]]; do
    printf '  scenario=%s harness=%s agent=%s model=%s\n' \
      "${job_fields[index]}" \
      "${job_fields[index+1]}" \
      "${job_fields[index+2]}" \
      "${job_fields[index+3]}"
    index=$(( index + 4 ))
  done
  exit 0
fi

printf '%s\0' "${job_fields[@]}" | xargs -0 -n 4 -P "${parallel}" "${self_path}" --run-one "${results_dir}" "${persona}" "${mode}" "${version}" "${skip_existing}"
