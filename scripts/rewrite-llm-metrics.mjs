#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  deriveLlmMetrics,
  extractUsageMetrics,
  normalizePricingModel,
} from "./llm-pricing.mjs";

const REPO_ROOT = process.cwd();
const CHECK_MODE = process.argv.includes("--check");
const SIDECAR_SUFFIXES = [
  ".agent-raw.json",
  ".trace.json",
  ".assertion-log.json",
  ".run-meta.json",
  ".session.jsonl",
];
const TRACKED_PATTERNS = [
  "results/*.json",
  "results/**/*.json",
  "apps/web/data/results/*.json",
  "apps/web/data/results/**/*.json",
  "results/audits/**/*.json",
  "apps/web/data/audits/**/*.json",
];
const PROCESSABLE_TRACE_SOURCES = new Set(["cursor-stream-json", "codex-jsonl"]);
const TARGET_AGENTS = new Set(["cursor", "codex"]);

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", ...TRACKED_PATTERNS], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readJson(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) return null;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function markChanged(changedFiles, relativePath, writeFn) {
  changedFiles.add(relativePath);
  if (!CHECK_MODE) {
    writeFn();
  }
}

function getTraceModel(trace) {
  const events = Array.isArray(trace?.events) ? trace.events : [];
  for (const event of events) {
    const payload = event?.payload;
    if (payload && typeof payload.model === "string" && payload.model.trim()) {
      return payload.model.trim();
    }
  }
  return null;
}

function traceHasExplicitCost(trace) {
  const events = Array.isArray(trace?.events) ? trace.events : [];
  for (const event of events) {
    const payload = event?.payload;
    const usage = extractUsageMetrics(payload?.usage ?? payload?.tokenUsage ?? payload?.metrics);
    if (usage.totalCostUsd > 0) {
      return true;
    }
  }
  return false;
}

function readJsonLines(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) return [];
  const parsed = [];
  const seen = new Set();
  const lines = readFileSync(absolutePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const key = JSON.stringify(event);
      if (seen.has(key)) {
        continue;
      }
      parsed.push(event);
      seen.add(key);
    } catch {
      // Keep any valid events we can recover from partially-corrupted sidecars.
    }
  }
  return parsed;
}

function inferTraceSource(container) {
  if (container?.agent === "codex") return "codex-jsonl";
  if (container?.agent === "cursor") return "cursor-stream-json";
  return "";
}

function buildTraceFromRawEvents(container, rawEvents) {
  const source = inferTraceSource(container);
  if (!PROCESSABLE_TRACE_SOURCES.has(source) || rawEvents.length === 0) {
    return null;
  }

  let agentSteps = 0;
  let assistantMessageCount = 0;
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalCostUsd: 0,
  };

  for (const event of rawEvents) {
    const eventType = typeof event?.type === "string" ? event.type : "";
    if (source === "codex-jsonl") {
      if (eventType === "turn.completed") {
        agentSteps += 1;
      }
      if (
        eventType === "item.completed" &&
        event?.item &&
        typeof event.item === "object" &&
        event.item.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        assistantMessageCount += 1;
      }
    } else if (
      /(turn|step)\.completed$/i.test(eventType) ||
      eventType === "turn_completed" ||
      eventType === "step_completed"
    ) {
      agentSteps += 1;
    } else if (eventType === "assistant") {
      assistantMessageCount += 1;
    }

    const eventUsage = extractUsageMetrics(event?.usage ?? event?.tokenUsage ?? event?.metrics);
    usage.inputTokens += eventUsage.inputTokens;
    usage.outputTokens += eventUsage.outputTokens;
    usage.cachedInputTokens += eventUsage.cachedInputTokens;
    usage.cacheCreationTokens += eventUsage.cacheCreationTokens;
    usage.cacheReadTokens += eventUsage.cacheReadTokens;
    usage.cacheWriteTokens += eventUsage.cacheWriteTokens;
    usage.totalCostUsd += eventUsage.totalCostUsd;
  }

  return {
    schemaVersion: "2",
    source,
    summary: {
      eventCount: rawEvents.length,
      agentSteps,
      assistantMessageCount,
    },
    usage,
    events: rawEvents.map((event, index) => ({
      id: `evt-${index + 1}`,
      kind: typeof event?.type === "string" ? event.type : "unknown",
      timestamp: typeof event?.timestamp === "string" ? event.timestamp : null,
      payload: event,
    })),
  };
}

function shouldRebuildTrace(container, trace) {
  if (container?.agent !== "cursor" || trace?.source !== "cursor-stream-json") {
    return false;
  }

  const requestIds = new Set();
  for (const event of trace?.events ?? []) {
    const payload = event?.payload;
    if (payload?.type !== "result" || typeof payload?.request_id !== "string") {
      continue;
    }
    if (requestIds.has(payload.request_id)) {
      return true;
    }
    requestIds.add(payload.request_id);
  }

  return false;
}

function resolveTrace(relativePath, traceRelativePath, container) {
  const parsedTrace = readJson(traceRelativePath);
  if (
    parsedTrace &&
    typeof parsedTrace === "object" &&
    !shouldRebuildTrace(container, parsedTrace)
  ) {
    return { trace: parsedTrace, needsRewrite: false };
  }

  const fallbackCandidates = relativePath.endsWith("/manifest.json")
    ? [
        path.join(path.dirname(relativePath), "logs", "agent-raw.json"),
        path.join(path.dirname(relativePath), "logs", "session.jsonl"),
        path.join(path.dirname(relativePath), "logs", "infra.stdout.log"),
      ]
    : [
        relativePath.replace(/\.json$/u, ".agent-raw.json"),
        relativePath.replace(/\.json$/u, ".session.jsonl"),
        relativePath.replace(/\.json$/u, ".infra.stdout"),
      ];

  let bestFallback = null;
  for (const candidate of fallbackCandidates) {
    const rawEvents = readJsonLines(candidate);
    const rebuiltTrace = buildTraceFromRawEvents(container, rawEvents);
    if (rebuiltTrace) {
      const usageValue =
        Number(rebuiltTrace?.usage?.inputTokens ?? 0) +
        Number(rebuiltTrace?.usage?.outputTokens ?? 0) +
        Number(rebuiltTrace?.usage?.cachedInputTokens ?? 0) +
        Number(rebuiltTrace?.usage?.cacheCreationTokens ?? 0) +
        Number(rebuiltTrace?.usage?.cacheReadTokens ?? 0) +
        Number(rebuiltTrace?.usage?.cacheWriteTokens ?? 0);
      if (usageValue > 0) {
        return { trace: rebuiltTrace, needsRewrite: true };
      }
      if (!bestFallback) {
        bestFallback = rebuiltTrace;
      }
    }
  }

  return bestFallback
    ? { trace: bestFallback, needsRewrite: true }
    : { trace: null, needsRewrite: false };
}

function resolvePricingMetrics(container, trace) {
  if (!trace || !PROCESSABLE_TRACE_SOURCES.has(String(trace.source ?? ""))) {
    return null;
  }
  if (!trace.usage || typeof trace.usage !== "object") {
    return null;
  }
  const explicitTraceCost = traceHasExplicitCost(trace);
  const pricingSourceHint = explicitTraceCost
    ? "agent-reported"
    : "derived-from-published-pricing";

  const candidates = [
    container?.run_metadata?.selectedModel,
    container?.runMetadata?.selectedModel,
    container?.model,
    getTraceModel(trace),
  ].filter((value) => typeof value === "string" && value.trim().length > 0);

  for (const candidate of candidates) {
    const metrics = deriveLlmMetrics({
      model: candidate,
      usage: {
        ...trace.usage,
        pricingSource: pricingSourceHint,
      },
    });
    if (metrics.pricingModel) {
      return metrics;
    }
  }

  return null;
}

function shouldAuditArtifact(container, trace) {
  const agent = typeof container?.agent === "string" ? container.agent : "";
  if (TARGET_AGENTS.has(agent)) return true;
  if (PROCESSABLE_TRACE_SOURCES.has(String(trace?.source ?? ""))) return true;
  return Boolean(
    normalizePricingModel(
      container?.run_metadata?.selectedModel ??
        container?.runMetadata?.selectedModel ??
        container?.model,
    ),
  );
}

function updateEfficiency(container, metrics) {
  const efficiency =
    container?.efficiency && typeof container.efficiency === "object" ? container.efficiency : {};
  const nextEfficiency = {
    ...efficiency,
    tokensUsed: metrics.tokensUsed,
    llmApiCostUsd: metrics.llmApiCostUsd,
    llmApiCostSource: metrics.llmApiCostSource,
    inputTokens: metrics.usage.inputTokens,
    outputTokens: metrics.usage.outputTokens,
    cachedInputTokens: metrics.usage.cachedInputTokens,
    cacheCreationTokens: metrics.usage.cacheCreationTokens,
    cacheReadTokens: metrics.usage.cacheReadTokens,
    cacheWriteTokens: metrics.usage.cacheWriteTokens,
  };
  const changed =
    Number(efficiency.tokensUsed ?? 0) !== metrics.tokensUsed ||
    Number(efficiency.llmApiCostUsd ?? 0) !== metrics.llmApiCostUsd ||
    String(efficiency.llmApiCostSource ?? "") !== metrics.llmApiCostSource ||
    Number(efficiency.inputTokens ?? 0) !== metrics.usage.inputTokens ||
    Number(efficiency.outputTokens ?? 0) !== metrics.usage.outputTokens ||
    Number(efficiency.cachedInputTokens ?? 0) !== metrics.usage.cachedInputTokens ||
    Number(efficiency.cacheCreationTokens ?? 0) !== metrics.usage.cacheCreationTokens ||
    Number(efficiency.cacheReadTokens ?? 0) !== metrics.usage.cacheReadTokens ||
    Number(efficiency.cacheWriteTokens ?? 0) !== metrics.usage.cacheWriteTokens;
  if (changed) {
    container.efficiency = nextEfficiency;
  }
  return changed;
}

function updateTraceUsage(trace, metrics) {
  const usage = trace?.usage && typeof trace.usage === "object" ? trace.usage : {};
  const changed =
    Number(usage.inputTokens ?? 0) !== metrics.usage.inputTokens ||
    Number(usage.outputTokens ?? 0) !== metrics.usage.outputTokens ||
    Number(usage.cachedInputTokens ?? 0) !== metrics.usage.cachedInputTokens ||
    Number(usage.cacheCreationTokens ?? 0) !== metrics.usage.cacheCreationTokens ||
    Number(usage.cacheReadTokens ?? 0) !== metrics.usage.cacheReadTokens ||
    Number(usage.cacheWriteTokens ?? 0) !== metrics.usage.cacheWriteTokens ||
    Number(usage.totalCostUsd ?? 0) !== metrics.llmApiCostUsd ||
    String(usage.pricingSource ?? "") !== metrics.llmApiCostSource;
  if (changed) {
    trace.usage = {
      ...usage,
      ...metrics.usage,
    };
  }
  return changed;
}

function collectResultTracePath(relativePath) {
  if (!relativePath.endsWith(".json")) return null;
  return relativePath.replace(/\.json$/u, ".trace.json");
}

function collectManifestTracePath(relativePath) {
  return path.join(path.dirname(relativePath), "logs", "trace.json");
}

function rewriteArtifacts(filePaths, getTracePath, changedFiles, issues) {
  for (const relativePath of filePaths) {
    const parsed = readJson(relativePath);
    if (!parsed || typeof parsed !== "object") continue;

    const traceRelativePath = getTracePath(relativePath);
    if (!traceRelativePath) continue;

    const { trace, needsRewrite: shouldWriteTrace } = resolveTrace(
      relativePath,
      traceRelativePath,
      parsed,
    );
    const metrics = resolvePricingMetrics(parsed, trace);
    const shouldAudit = shouldAuditArtifact(parsed, trace);

    if (!metrics) {
      if (
        shouldAudit &&
        (Number(parsed?.efficiency?.llmApiCostUsd ?? 0) <= 0 ||
          Number(parsed?.efficiency?.tokensUsed ?? 0) <= 0)
      ) {
        issues.push(`${relativePath} (missing pricing metrics source)`);
      }
      continue;
    }

    const artifactChanged = updateEfficiency(parsed, metrics);
    const traceChanged = trace ? updateTraceUsage(trace, metrics) : false;

    if (artifactChanged) {
      markChanged(changedFiles, relativePath, () => writeJson(relativePath, parsed));
    }
    if (trace && (traceChanged || shouldWriteTrace)) {
      markChanged(changedFiles, traceRelativePath, () => writeJson(traceRelativePath, trace));
    }

    if (metrics.llmApiCostUsd <= 0 || metrics.tokensUsed <= 0) {
      issues.push(`${relativePath} (non-positive pricing metrics after rewrite)`);
    }
  }
}

function main() {
  const changedFiles = new Set();
  const issues = [];
  const trackedFiles = listTrackedFiles();
  const resultFiles = trackedFiles.filter(
    (relativePath) =>
      relativePath.endsWith(".json") &&
      !relativePath.includes("/audits/") &&
      !relativePath.endsWith("-summary.json") &&
      !SIDECAR_SUFFIXES.some((suffix) => relativePath.endsWith(suffix)),
  );
  const manifestFiles = trackedFiles.filter((relativePath) => relativePath.endsWith("/manifest.json"));

  rewriteArtifacts(resultFiles, collectResultTracePath, changedFiles, issues);
  rewriteArtifacts(manifestFiles, collectManifestTracePath, changedFiles, issues);

  if (CHECK_MODE && (changedFiles.size > 0 || issues.length > 0)) {
    if (changedFiles.size > 0) {
      console.error("LLM metrics are out of sync in tracked artifacts:");
      for (const relativePath of [...changedFiles].sort((a, b) => a.localeCompare(b))) {
        console.error(`- ${relativePath}`);
      }
    }
    if (issues.length > 0) {
      console.error("LLM metrics could not be resolved for:");
      for (const issue of issues.sort((a, b) => a.localeCompare(b))) {
        console.error(`- ${issue}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (!CHECK_MODE && issues.length > 0) {
    console.warn("Some tracked artifacts still have unresolved LLM metrics:");
    for (const issue of issues.sort((a, b) => a.localeCompare(b))) {
      console.warn(`- ${issue}`);
    }
  }
}

main();
