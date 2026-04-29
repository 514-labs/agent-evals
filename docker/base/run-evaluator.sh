#!/usr/bin/env bash
# Phase 2 of a dec-bench run: run the assertion suite against the post-agent
# state and emit the evaluator-side output markers. Run by the CLI via
# `docker exec` only AFTER /scenario/assertions/ has been `docker cp`'d into
# the container — the agent phase never has access to assertion files on disk.
#
# Re-discovers env that lived in run-agent.sh memory by re-sourcing scenario
# env and re-reading agent-metrics.json. Exits with the saved agent exit code
# so the run's overall exit status matches the pre-split behavior.

set -euo pipefail

# shellcheck source=/opt/dec-bench/lib.sh
. /opt/dec-bench/lib.sh

if [[ ! -d /scenario/assertions ]]; then
  echo "Missing /scenario/assertions — the CLI must docker cp it into the container before running this script." >&2
  exit 1
fi

agent_exit_code=0
if [[ -f "${AGENT_EXIT_CODE_PATH}" ]]; then
  agent_exit_code="$(cat "${AGENT_EXIT_CODE_PATH}")"
fi

wall_clock_seconds=0
if [[ -f "${WALL_CLOCK_PATH}" ]]; then
  wall_clock_seconds="$(cat "${WALL_CLOCK_PATH}")"
fi

detect_services

export AGENT_EXIT_CODE="${agent_exit_code}"
export EVAL_WALL_CLOCK_SECONDS="${wall_clock_seconds}"
export EVAL_AGENT_STEPS="${EVAL_AGENT_STEPS:-0}"
export EVAL_TOKENS_USED="${EVAL_TOKENS_USED:-0}"
export EVAL_LLM_API_COST_USD="${EVAL_LLM_API_COST_USD:-0}"
export EVAL_LLM_API_COST_SOURCE="${EVAL_LLM_API_COST_SOURCE:-}"
export EVAL_INPUT_TOKENS="${EVAL_INPUT_TOKENS:-0}"
export EVAL_OUTPUT_TOKENS="${EVAL_OUTPUT_TOKENS:-0}"
export EVAL_CACHED_INPUT_TOKENS="${EVAL_CACHED_INPUT_TOKENS:-0}"
export EVAL_CACHE_CREATION_TOKENS="${EVAL_CACHE_CREATION_TOKENS:-0}"
export EVAL_CACHE_READ_TOKENS="${EVAL_CACHE_READ_TOKENS:-0}"
export EVAL_CACHE_WRITE_TOKENS="${EVAL_CACHE_WRITE_TOKENS:-0}"
export EVAL_SESSION_LOG_PATH="${SESSION_LOG_PATH}"
export EVAL_RUN_METADATA_JSON="${EVAL_RUN_METADATA_JSON:-{}}"
export ASSERTION_LOG_PATH="${ASSERTION_LOG_PATH}"

if [[ -f "${AGENT_METRICS_PATH}" ]]; then
  eval "$(
    node -e '
const fs = require("node:fs");
const path = process.argv[1];
let parsed = {};
try {
  parsed = JSON.parse(fs.readFileSync(path, "utf8"));
} catch {
  parsed = {};
}
const safeNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const safeText = (value) => (typeof value === "string" ? value : "");
process.stdout.write(`EVAL_AGENT_STEPS=${safeNum(parsed.agentSteps)}\n`);
process.stdout.write(`EVAL_TOKENS_USED=${safeNum(parsed.tokensUsed)}\n`);
process.stdout.write(`EVAL_LLM_API_COST_USD=${safeNum(parsed.llmApiCostUsd)}\n`);
process.stdout.write(`EVAL_LLM_API_COST_SOURCE=${JSON.stringify(safeText(parsed.llmApiCostSource))}\n`);
process.stdout.write(`EVAL_INPUT_TOKENS=${safeNum(parsed.inputTokens)}\n`);
process.stdout.write(`EVAL_OUTPUT_TOKENS=${safeNum(parsed.outputTokens)}\n`);
process.stdout.write(`EVAL_CACHED_INPUT_TOKENS=${safeNum(parsed.cachedInputTokens)}\n`);
process.stdout.write(`EVAL_CACHE_CREATION_TOKENS=${safeNum(parsed.cacheCreationTokens)}\n`);
process.stdout.write(`EVAL_CACHE_READ_TOKENS=${safeNum(parsed.cacheReadTokens)}\n`);
process.stdout.write(`EVAL_CACHE_WRITE_TOKENS=${safeNum(parsed.cacheWriteTokens)}\n`);
' "${AGENT_METRICS_PATH}"
  )"
fi

if [[ -f "${RUN_META_PATH}" ]]; then
  export EVAL_RUN_METADATA_JSON="$(cat "${RUN_META_PATH}")"
fi

# 514-1358: Surface the meta-judges directory if the CLI copied one in
# (see apps/cli/src/commands/run.rs::copy_meta_judges_into_container).
# The runner skips meta-judges silently when this is unset.
if [[ -d /opt/dec-bench/meta-judges ]]; then
  export EVAL_META_JUDGES_DIR="/opt/dec-bench/meta-judges"
fi

# 514-1358: Extract the prompt path from run metadata so per-scenario and
# meta judges that opt into the "prompt" input can read the prompt file.
if [[ -n "${EVAL_RUN_METADATA_JSON:-}" && "${EVAL_RUN_METADATA_JSON}" != "{}" ]]; then
  prompt_path="$(node -e '
try {
  const parsed = JSON.parse(process.argv[1] || "{}");
  process.stdout.write(typeof parsed.promptPath === "string" ? parsed.promptPath : "");
} catch { process.stdout.write(""); }
' "${EVAL_RUN_METADATA_JSON}")"
  if [[ -n "${prompt_path}" && -f "${prompt_path}" ]]; then
    export EVAL_PROMPT_PATH="${prompt_path}"
  fi
fi

# Re-source scenario env before running assertions so harnesses whose
# env.sh depends on seed-produced state (e.g. tinybird-forward writes
# /workspace/.tb-env with the workspace name + admin token that the seed
# discovers) see the updated exports. Phase-1 sourced earlier; this is a
# no-op for harnesses whose env.sh is purely declarative.
source_scenario_env

# Best-effort: if ClickHouse isn't running and recovery fails, the assertions
# will report that themselves. Don't let internal subshell errors abort the
# evaluator phase before it gets a chance to write result.json.
ensure_clickhouse_for_assertions || true

tsx /opt/dec-bench/eval-core/src/cli.ts /scenario/assertions > "${RESULT_JSON_PATH}"
echo "${EVAL_RESULT_START}"
cat "${RESULT_JSON_PATH}"
echo "${EVAL_RESULT_END}"

if [[ -f "${ASSERTION_LOG_PATH}" ]]; then
  echo "${ASSERTION_LOG_START}"
  cat "${ASSERTION_LOG_PATH}"
  echo "${ASSERTION_LOG_END}"
fi

echo "${SERVICE_LOGS_START}"
collect_service_logs
echo "${SERVICE_LOGS_END}"

exit "${agent_exit_code}"
