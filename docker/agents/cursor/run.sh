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

if ! command -v agent >/dev/null 2>&1; then
  echo "Cursor Agent CLI is not installed in this image (missing 'agent' binary)." >&2
  exit 1
fi

if [[ -z "${CURSOR_API_KEY:-}" ]]; then
  echo "Missing API key: set CURSOR_API_KEY." >&2
  exit 1
fi

SYSTEM_PROMPT="You are running inside a sandboxed Docker container for a benchmark evaluation. You have full tool access. Do NOT ask for permission or propose commands for the user to run. Execute all fixes directly, then verify they work by running the relevant scripts and queries yourself. IMPORTANT: never run long-lived servers in the foreground. Start them in the background (for example with '&' and redirected logs), then continue with the rest of the task. If you start a local API server, immediately verify it with curl and proceed. Your work is scored by automated assertions after you finish."
PROMPT_CONTENT="$(cat "${PROMPT_FILE}")"
FULL_PROMPT="${SYSTEM_PROMPT}

${PROMPT_CONTENT}"
export BENCH_SYSTEM_PROMPT="${SYSTEM_PROMPT}"

mkdir -p "${OUTPUT_DIR}"

CURSOR_MODEL="${MODEL:-auto}"
if [[ "${CURSOR_MODEL}" == "composer" ]]; then
  CURSOR_MODEL="composer-1.5"
fi

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
  agent: "cursor",
  persona,
  planMode,
  promptPath,
  promptSha256,
  promptContent,
  promptPreview: promptContent.slice(0, 1000),
};
fs.writeFileSync(runMetaPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
'

set +e
CURSOR_OUTPUT="$(
  CURSOR_API_KEY="${CURSOR_API_KEY}" \
    agent \
      -p "${FULL_PROMPT}" \
      --output-format stream-json \
      --sandbox disabled \
      --force \
      --trust \
      --model "${CURSOR_MODEL}"
)"
cursor_exit_code=$?
set -e

printf '%s' "${CURSOR_OUTPUT}" | node -e '
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

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeText = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter((item) => item.length > 0).join("\n");
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (Array.isArray(value.content)) return normalizeText(value.content);
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return "";
};

const BENCH_SYSTEM_PROMPT_PREFIX = "You are running inside a sandboxed Docker container for a benchmark evaluation.";
const splitBenchSystemPrompt = (text) => {
  if (typeof text !== "string" || text.length === 0) {
    return { systemPrompt: "", userPrompt: text ?? "" };
  }
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(BENCH_SYSTEM_PROMPT_PREFIX)) {
    return { systemPrompt: "", userPrompt: text };
  }

  const fullSystemPrompt =
    typeof process.env.BENCH_SYSTEM_PROMPT === "string" ? process.env.BENCH_SYSTEM_PROMPT : "";
  let systemPrompt = "";
  let userPrompt = "";

  if (fullSystemPrompt && trimmed.startsWith(fullSystemPrompt)) {
    systemPrompt = fullSystemPrompt;
    userPrompt = trimmed.slice(fullSystemPrompt.length).trimStart();
  } else {
    const splitIdx = trimmed.indexOf("\n\n");
    if (splitIdx >= 0) {
      systemPrompt = trimmed.slice(0, splitIdx).trim();
      userPrompt = trimmed.slice(splitIdx + 2).trimStart();
    }
  }

  if (systemPrompt.length === 0) {
    return { systemPrompt: "", userPrompt: text };
  }
  return {
    systemPrompt,
    userPrompt: userPrompt.length > 0 ? userPrompt : text,
  };
};

const extractMessageText = (message) => {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    const chunks = [];
    for (const block of message.content) {
      if (!block || typeof block !== "object") continue;
      if (typeof block.text === "string") {
        chunks.push(block.text);
        continue;
      }
      if (typeof block.content === "string") {
        chunks.push(block.content);
      }
    }
    if (chunks.length > 0) return chunks.join("\n");
  }
  return normalizeText(message);
};

const normalizeToolName = (toolCall) => {
  if (!toolCall || typeof toolCall !== "object") return "";
  const first = Object.keys(toolCall)[0];
  if (!first) return "";
  const withoutSuffix = first.replace(/ToolCall$/, "");
  return withoutSuffix || first;
};

const extractToolArgs = (toolCall) => {
  if (!toolCall || typeof toolCall !== "object") return null;
  const first = Object.values(toolCall)[0];
  if (!first || typeof first !== "object") return null;
  return first.args ?? null;
};

const extractToolResult = (toolCall) => {
  if (!toolCall || typeof toolCall !== "object") {
    return { isError: false, content: "" };
  }
  const first = Object.values(toolCall)[0];
  if (!first || typeof first !== "object") {
    return { isError: false, content: "" };
  }
  const result = first.result;
  if (!result || typeof result !== "object") {
    return { isError: false, content: "" };
  }

  let isError = false;
  let content = "";

  if (result.success && typeof result.success === "object") {
    const success = result.success;
    const stdout = normalizeText(success.stdout ?? success.interleavedOutput ?? success.content ?? "");
    const stderr = normalizeText(success.stderr ?? "");
    content = [stdout, stderr].filter((part) => part.trim().length > 0).join("\n");
  }
  if (result.error !== undefined) {
    isError = true;
    const errorText = normalizeText(result.error);
    content = [content, errorText].filter((part) => part.trim().length > 0).join("\n");
  }
  if (!content) {
    content = normalizeText(result);
  }

  return { isError, content };
};

let inputTokens = 0;
let outputTokens = 0;
let totalCostUsd = 0;
let agentSteps = 0;
const assistantMessages = [];
const traceEvents = [];

let idx = 0;
for (const evt of parsedEvents) {
  idx += 1;
  const type = typeof evt?.type === "string" ? evt.type : "unknown";
  const timestampMs = toNumber(evt?.timestamp_ms ?? evt?.timestampMs);
  const timestamp =
    typeof evt?.timestamp === "string"
      ? evt.timestamp
      : timestampMs > 0
        ? new Date(timestampMs).toISOString()
        : null;

  const usageCandidate = evt?.usage ?? evt?.tokenUsage ?? evt?.metrics ?? null;
  if (usageCandidate && typeof usageCandidate === "object") {
    inputTokens += toNumber(
      usageCandidate.input_tokens ??
        usageCandidate.inputTokens ??
        usageCandidate.prompt_tokens ??
        usageCandidate.promptTokens
    );
    outputTokens += toNumber(
      usageCandidate.output_tokens ??
        usageCandidate.outputTokens ??
        usageCandidate.completion_tokens ??
        usageCandidate.completionTokens
    );
    totalCostUsd += toNumber(
      usageCandidate.total_cost_usd ??
        usageCandidate.totalCostUsd ??
        usageCandidate.cost_usd ??
        usageCandidate.costUsd
    );
  }

  if (/(turn|step)\.completed$/i.test(type) || type === "turn_completed" || type === "step_completed") {
    agentSteps += 1;
  }

  const baseEvent = {
    id: `evt-${idx}`,
    kind: "event",
    timestamp,
    payload: evt,
  };

  if (type === "user") {
    const parsedMessage = splitBenchSystemPrompt(
      extractMessageText(evt?.message ?? evt?.content ?? evt?.text)
    );
    if (parsedMessage.systemPrompt.trim().length > 0) {
      traceEvents.push({
        ...baseEvent,
        id: `${baseEvent.id}.system`,
        kind: "system_message",
        role: "system",
        content: parsedMessage.systemPrompt,
      });
    }
    traceEvents.push({
      ...baseEvent,
      id: `${baseEvent.id}.user`,
      kind: "user_message",
      role: "user",
      content: parsedMessage.userPrompt,
    });
    continue;
  }

  if (type === "assistant") {
    const content = extractMessageText(evt?.message ?? evt?.content ?? evt?.text);
    if (content.trim().length === 0) continue;
    assistantMessages.push(content);
    traceEvents.push({
      ...baseEvent,
      kind: "assistant_text",
      role: "assistant",
      model: evt?.model ?? evt?.message?.model ?? null,
      content,
    });
    continue;
  }

  if (type === "thinking") {
    const content = normalizeText(evt?.text ?? evt?.message ?? "");
    if (content.trim().length === 0) continue;
    traceEvents.push({
      ...baseEvent,
      kind: "thinking",
      role: "assistant",
      content,
    });
    continue;
  }

  if (type === "tool_call") {
    const subtype = typeof evt?.subtype === "string" ? evt.subtype : "";
    const toolName = normalizeToolName(evt?.tool_call);
    const toolUseId = evt?.call_id ?? null;
    const args = extractToolArgs(evt?.tool_call);
    if (subtype === "started") {
      const content = normalizeText(
        args?.description ?? args?.command ?? args?.path ?? args ?? ""
      );
      traceEvents.push({
        ...baseEvent,
        kind: "tool_use",
        role: "assistant",
        name: toolName || "tool",
        toolName: toolName || undefined,
        toolUseId,
        input: args,
        content,
      });
      continue;
    }
    const result = extractToolResult(evt?.tool_call);
    traceEvents.push({
      ...baseEvent,
      kind: "tool_result",
      role: "tool",
      toolName: toolName || undefined,
      toolUseId,
      isError: result.isError,
      content: result.content,
    });
    continue;
  }

  if (type === "result") {
    const content = normalizeText(evt?.result ?? evt?.message ?? evt?.text ?? "");
    if (content.trim().length > 0) {
      assistantMessages.push(content);
    }
    traceEvents.push({
      ...baseEvent,
      kind: "assistant_final",
      role: "assistant",
      isError: Boolean(evt?.is_error),
      content,
    });
    continue;
  }

  traceEvents.push({
    ...baseEvent,
    kind: type === "system" ? "event" : type,
    role: type === "system" ? "system" : undefined,
    content: normalizeText(evt?.text ?? evt?.message ?? evt?.content ?? ""),
  });
}

if (agentSteps === 0) {
  agentSteps = parsedEvents.length;
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
  agentSteps,
  tokensUsed: inputTokens + outputTokens,
  llmApiCostUsd: totalCostUsd,
};
fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

const trace = {
  schemaVersion: "2",
  source: "cursor-stream-json",
  summary: {
    eventCount: traceEvents.length,
    agentSteps,
    assistantMessageCount: assistantMessages.length,
  },
  usage: {
    inputTokens,
    outputTokens,
    totalCostUsd,
  },
  events: traceEvents,
};

if (tracePath) {
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
}
'

exit "${cursor_exit_code}"
