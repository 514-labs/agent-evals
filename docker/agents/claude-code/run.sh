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

SYSTEM_PROMPT="You are running inside a sandboxed Docker container for a benchmark evaluation. You have full tool access. Do NOT ask for permission or propose commands for the user to run. Execute all fixes directly, then verify they work by running the relevant scripts and queries yourself. IMPORTANT: never run long-lived servers in the foreground. Start them in the background (for example with '&' and redirected logs), then continue with the rest of the task. If you start a local API server, immediately verify it with curl and proceed. Your work is scored by automated assertions after you finish."
PROMPT_CONTENT="$(cat "${PROMPT_FILE}")"

CLAUDE_ARGS=(
  -p "${PROMPT_CONTENT}"
  --model "${MODEL:-claude-sonnet-4-20250514}"
  --dangerously-skip-permissions
  --append-system-prompt "${SYSTEM_PROMPT}"
  --max-turns 50
  --output-format json
)

mkdir -p "${OUTPUT_DIR}"

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
  persona,
  planMode,
  promptPath,
  promptSha256,
  promptContent,
  promptPreview: promptContent.slice(0, 1000),
};
fs.writeFileSync(runMetaPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
'

CLAUDE_OUTPUT="$(
  IS_SANDBOX="${IS_SANDBOX:-1}" claude "${CLAUDE_ARGS[@]}"
)"

printf '%s' "${CLAUDE_OUTPUT}" | node -e '
const fs = require("node:fs");
const path = require("node:path");
const raw = fs.readFileSync(0, "utf8");
const rawPath = process.env.AGENT_RAW_PATH;
if (!rawPath) {
  process.stderr.write("AGENT_RAW_PATH not provided.\n");
  process.exit(1);
}
fs.writeFileSync(rawPath, `${raw}\n`, "utf8");

let parsed = {};
try {
  parsed = JSON.parse(raw);
} catch (err) {
  process.stderr.write(`Failed to parse claude JSON output: ${String(err)}\n`);
  process.exit(1);
}

const usage =
  parsed && typeof parsed.usage === "object" && parsed.usage !== null
    ? parsed.usage
    : {};
const inputTokens = Number(parsed.input_tokens ?? usage.input_tokens ?? 0) || 0;
const outputTokens = Number(parsed.output_tokens ?? usage.output_tokens ?? 0) || 0;
const cacheCreationTokens =
  Number(parsed.cache_creation_tokens ?? usage.cache_creation_tokens ?? 0) || 0;
const cacheReadTokens =
  Number(parsed.cache_read_tokens ?? usage.cache_read_tokens ?? 0) || 0;
const totalCostUsd = Number(parsed.total_cost_usd ?? 0) || 0;
const agentSteps = Number(parsed.num_turns ?? 0) || 0;
const resultText = typeof parsed.result === "string" ? parsed.result : "";

process.stdout.write(resultText);
if (!resultText.endsWith("\n")) {
  process.stdout.write("\n");
}

const metricsPath = process.env.METRICS_PATH;
if (!metricsPath) {
  process.stderr.write("METRICS_PATH not provided.\n");
  process.exit(1);
}
const metrics = {
  agentSteps,
  tokensUsed: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
  llmApiCostUsd: totalCostUsd,
  llmApiCostSource: "agent-reported",
  inputTokens,
  outputTokens,
  cachedInputTokens: 0,
  cacheCreationTokens,
  cacheReadTokens,
  cacheWriteTokens: 0,
};
fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

// --- Find and copy session JSONL from Claude local storage ---
const sessionId = typeof parsed.session_id === "string" ? parsed.session_id : "";
const sessionJsonlPath = process.env.SESSION_JSONL_PATH;
const tracePath = process.env.TRACE_PATH;

let sessionLines = [];

if (sessionId && sessionJsonlPath) {
  const homeDir = process.env.HOME || "/root";
  const claudeDir = path.join(homeDir, ".claude");
  let found = false;

  const findSessionFile = (dir) => {
    if (!fs.existsSync(dir)) return null;
    const target = `${sessionId}.jsonl`;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === target) return fullPath;
        if (entry.isDirectory()) {
          const result = findSessionFile(fullPath);
          if (result) return result;
        }
      }
    } catch {}
    return null;
  };

  const sessionFile = findSessionFile(claudeDir);
  if (sessionFile) {
    fs.copyFileSync(sessionFile, sessionJsonlPath);
    found = true;
    process.stderr.write(`Found session JSONL at ${sessionFile}\n`);
    try {
      const content = fs.readFileSync(sessionFile, "utf8");
      sessionLines = content.split("\n").filter(l => l.trim());
    } catch {}
  }

  if (!found) {
    const debugDirs = [];
    const walkForDebug = (d, depth) => {
      if (depth > 3 || !fs.existsSync(d)) return;
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            debugDirs.push(path.join(d, entry.name));
            walkForDebug(path.join(d, entry.name), depth + 1);
          } else if (entry.name.endsWith(".jsonl")) {
            debugDirs.push(`  FILE: ${path.join(d, entry.name)}`);
          }
        }
      } catch {}
    };
    walkForDebug(claudeDir, 0);
    process.stderr.write(`Session JSONL not found for session_id=${sessionId}\n`);
    process.stderr.write(`Searched under: ${claudeDir}\n`);
    process.stderr.write(`Directory structure:\n${debugDirs.slice(0, 30).join("\n")}\n`);
  }
}

// --- Build trace from session JSONL (rich per-turn events) ---
const events = [];
let evtIdx = 0;
const pushEvent = (kind, payload) => {
  evtIdx++;
  events.push({ id: `evt-${evtIdx}`, kind, ...payload });
};
const normalizeText = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeText).join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return "";
};

const toolUseNames = {};

for (const line of sessionLines) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    continue;
  }
  const recordType = record.type;
  const ts = record.timestamp ?? null;

  if (recordType === "assistant" && record.message?.content) {
    const content = record.message.content;
    const model = record.message.model ?? null;
    const turnUsage = record.message.usage ?? null;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const blockType = block.type;
      if (blockType === "thinking") {
        pushEvent("thinking", {
          role: "assistant",
          model,
          timestamp: ts,
          content: normalizeText(block.thinking ?? block.text ?? ""),
        });
      } else if (blockType === "text") {
        pushEvent("assistant_text", {
          role: "assistant",
          model,
          timestamp: ts,
          content: normalizeText(block.text ?? ""),
        });
      } else if (blockType === "tool_use") {
        const toolName = block.name ?? "unknown_tool";
        toolUseNames[block.id] = toolName;
        pushEvent("tool_use", {
          role: "assistant",
          model,
          timestamp: ts,
          name: toolName,
          toolUseId: block.id ?? null,
          input: block.input ?? null,
        });
      }
    }
  } else if (recordType === "tool_result" && record.toolUseResult) {
    const result = record.toolUseResult;
    const toolUseId = result.tool_use_id ?? null;
    pushEvent("tool_result", {
      role: "tool",
      timestamp: ts,
      toolUseId,
      toolName: toolUseNames[toolUseId] ?? null,
      isError: result.is_error ?? false,
      content: normalizeText(result.content ?? ""),
    });
  } else if (recordType === "user" && record.message?.content) {
    const userContent = record.message.content;
    if (Array.isArray(userContent)) {
      for (const block of userContent) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "tool_result") {
          const toolUseId = block.tool_use_id ?? null;
          const resultContent = Array.isArray(block.content)
            ? block.content.map(c => normalizeText(c.text ?? c.content ?? c)).join("\n")
            : normalizeText(block.content ?? "");
          pushEvent("tool_result", {
            role: "tool",
            timestamp: ts,
            toolUseId,
            toolName: toolUseNames[toolUseId] ?? null,
            isError: block.is_error ?? false,
            content: resultContent,
          });
        }
      }
    } else if (typeof userContent === "string") {
      pushEvent("user_message", {
        role: "user",
        timestamp: ts,
        content: userContent,
      });
    }
  } else if (recordType === "summary") {
    pushEvent("summary", {
      role: "system",
      timestamp: ts,
      content: normalizeText(record.summary ?? record.message ?? ""),
    });
  }
}

if (events.length === 0 && resultText) {
  pushEvent("assistant_final", { role: "assistant", content: resultText });
}

const traceSummary = {
  agentSteps,
  toolCallCount: events.filter((e) => e.kind === "tool_use").length,
  toolResultCount: events.filter((e) => e.kind === "tool_result").length,
  thinkingCount: events.filter((e) => e.kind === "thinking").length,
  assistantTextCount: events.filter((e) => e.kind === "assistant_text").length,
  eventCount: events.length,
};
const trace = {
  schemaVersion: "2",
  source: sessionLines.length > 0 ? "claude-session-jsonl" : "claude-output-json",
  sessionId: sessionId || null,
  summary: traceSummary,
  usage: {
    inputTokens,
    outputTokens,
    cachedInputTokens: 0,
    cacheCreationTokens,
    cacheReadTokens,
    cacheWriteTokens: 0,
    totalCostUsd,
    pricingSource: "agent-reported",
  },
  events,
};
if (tracePath) {
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
}
'
