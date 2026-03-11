#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="/scenario/prompts/${PERSONA:-naive}.md"
OUTPUT_DIR="${OUTPUT_DIR:-/output}"
METRICS_PATH="${OUTPUT_DIR}/agent-metrics.json"
RUN_META_PATH="${OUTPUT_DIR}/run-meta.json"
AGENT_RAW_PATH="${OUTPUT_DIR}/agent-raw.json"
TRACE_PATH="${OUTPUT_DIR}/agent-trace.json"
SESSION_JSONL_PATH="${OUTPUT_DIR}/session.jsonl"
export METRICS_PATH
export RUN_META_PATH
export AGENT_RAW_PATH
export TRACE_PATH
export SESSION_JSONL_PATH
export PROMPT_FILE

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "Prompt file not found: ${PROMPT_FILE}" >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI is not installed in this image (missing 'codex' binary)." >&2
  exit 1
fi

if [[ -z "${CODEX_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Missing API key: set CODEX_API_KEY (or OPENAI_API_KEY)." >&2
  exit 1
fi

SYSTEM_PROMPT="You are running inside a sandboxed Docker container for a benchmark evaluation. You have full tool access. Do NOT ask for permission or propose commands for the user to run. Execute all fixes directly, then verify they work by running the relevant scripts and queries yourself. IMPORTANT: never run long-lived servers in the foreground. Start them in the background (for example with '&' and redirected logs), then continue with the rest of the task. If you start a local API server, immediately verify it with curl and proceed. Your work is scored by automated assertions after you finish."
PROMPT_CONTENT="$(cat "${PROMPT_FILE}")"
FULL_PROMPT="${SYSTEM_PROMPT}

${PROMPT_CONTENT}"

mkdir -p "${OUTPUT_DIR}"

CODEX_MODEL="${MODEL:-gpt-5-codex}"

node -e '
const fs = require("node:fs");
const crypto = require("node:crypto");

const promptPath = process.env.PROMPT_FILE;
if (!promptPath) {
  process.stderr.write("PROMPT_FILE not provided.\n");
  process.exit(1);
}
const runMetaPath = process.env.RUN_META_PATH;
if (!runMetaPath) {
  process.stderr.write("RUN_META_PATH not provided.\n");
  process.exit(1);
}
const promptContent = fs.readFileSync(promptPath, "utf8");
const promptSha256 = crypto.createHash("sha256").update(promptContent, "utf8").digest("hex");
const persona = process.env.PERSONA || "naive";
const planMode = process.env.PLAN_MODE || "no-plan";
const metadata = {
  agent: "codex",
  persona,
  planMode,
  promptPath,
  promptSha256,
  promptContent,
  promptPreview: promptContent.slice(0, 1000),
};
fs.writeFileSync(runMetaPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
'

declare -a CODEX_MODEL_CANDIDATES=("${CODEX_MODEL}")
if [[ "${CODEX_MODEL}" == "spark" ]]; then
  # Try provider aliases first, then a broadly available fallback.
  CODEX_MODEL_CANDIDATES=("spark" "gpt-5.3-codex-spark-preview" "gpt-5.1-codex-mini")
fi

CODEX_OUTPUT=""
codex_exit_code=1
selected_codex_model="${CODEX_MODEL_CANDIDATES[0]}"
for candidate_model in "${CODEX_MODEL_CANDIDATES[@]}"; do
  set +e
  ATTEMPT_OUTPUT="$(
    CODEX_API_KEY="${CODEX_API_KEY:-${OPENAI_API_KEY:-}}" \
      codex exec \
        --json \
        --dangerously-bypass-approvals-and-sandbox \
        --skip-git-repo-check \
        --cd / \
        --model "${candidate_model}" \
        "${FULL_PROMPT}" 2>&1
  )"
  attempt_exit_code=$?
  set -e

  CODEX_OUTPUT="${ATTEMPT_OUTPUT}"
  codex_exit_code=$attempt_exit_code
  selected_codex_model="${candidate_model}"
  if [[ ${attempt_exit_code} -eq 0 ]]; then
    break
  fi

  if [[ "${ATTEMPT_OUTPUT}" == *"does not exist"* ]] || [[ "${ATTEMPT_OUTPUT}" == *"do not have access"* ]]; then
    echo "Codex model unavailable, trying fallback: ${candidate_model}" >&2
    continue
  fi
  break
done

SELECTED_CODEX_MODEL="${selected_codex_model}" node -e '
const fs = require("node:fs");
const runMetaPath = process.env.RUN_META_PATH;
if (!runMetaPath) process.exit(0);
let meta = {};
try {
  meta = JSON.parse(fs.readFileSync(runMetaPath, "utf8"));
} catch {}
meta.requestedModel = process.env.MODEL || "gpt-5-codex";
meta.selectedModel = process.env.SELECTED_CODEX_MODEL || meta.requestedModel;
meta.usedModelFallback = meta.requestedModel !== meta.selectedModel;
fs.writeFileSync(runMetaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
'

printf '%s' "${CODEX_OUTPUT}" | node -e '
const fs = require("node:fs");

const raw = fs.readFileSync(0, "utf8");
const rawPath = process.env.AGENT_RAW_PATH;
const sessionJsonlPath = process.env.SESSION_JSONL_PATH;
const tracePath = process.env.TRACE_PATH;
const metricsPath = process.env.METRICS_PATH;
if (!rawPath || !metricsPath) {
  process.stderr.write("AGENT_RAW_PATH or METRICS_PATH missing.\n");
  process.exit(1);
}

fs.writeFileSync(rawPath, raw.endsWith("\n") ? raw : `${raw}\n`, "utf8");
if (sessionJsonlPath) {
  fs.writeFileSync(sessionJsonlPath, raw.endsWith("\n") ? raw : `${raw}\n`, "utf8");
}

const lines = raw.split("\n").filter((line) => line.trim().length > 0);
const parsedEvents = [];
const passthroughLines = [];
for (const line of lines) {
  try {
    parsedEvents.push(JSON.parse(line));
  } catch {
    passthroughLines.push(line);
  }
}

let inputTokens = 0;
let outputTokens = 0;
let cachedInputTokens = 0;
let totalCostUsd = 0;
let turnCompleted = 0;
const assistantMessages = [];
const traceEvents = [];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

let idx = 0;
for (const evt of parsedEvents) {
  idx += 1;
  const type = typeof evt?.type === "string" ? evt.type : "unknown";
  traceEvents.push({
    id: `evt-${idx}`,
    kind: type,
    timestamp: evt?.timestamp ?? null,
    payload: evt,
  });

  if (type === "turn.completed") {
    turnCompleted += 1;
    const usage = evt?.usage ?? {};
    inputTokens += toNumber(usage.input_tokens ?? usage.inputTokens);
    outputTokens += toNumber(usage.output_tokens ?? usage.outputTokens);
    cachedInputTokens += toNumber(usage.cached_input_tokens ?? usage.cachedInputTokens);
    totalCostUsd += toNumber(usage.total_cost_usd ?? usage.totalCostUsd ?? usage.cost_usd);
  }

  const item = evt?.item;
  if (type === "item.completed" && item && typeof item === "object") {
    if (item.type === "agent_message" && typeof item.text === "string") {
      assistantMessages.push(item.text);
    }
  }
}

const finalText =
  assistantMessages.length > 0
    ? assistantMessages[assistantMessages.length - 1]
    : passthroughLines.length > 0
      ? passthroughLines[passthroughLines.length - 1]
      : "";

if (finalText) {
  process.stdout.write(finalText);
  if (!finalText.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

const metrics = {
  agentSteps: turnCompleted,
  tokensUsed: inputTokens + outputTokens + cachedInputTokens,
  llmApiCostUsd: totalCostUsd,
};
fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

const trace = {
  schemaVersion: "2",
  source: "codex-jsonl",
  summary: {
    eventCount: traceEvents.length,
    agentSteps: turnCompleted,
    turnCompletedCount: turnCompleted,
    assistantMessageCount: assistantMessages.length,
  },
  usage: {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalCostUsd,
  },
  events: traceEvents,
};

if (tracePath) {
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
}
'

exit "${codex_exit_code}"
