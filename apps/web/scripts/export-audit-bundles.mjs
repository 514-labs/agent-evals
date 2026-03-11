#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

const SIDECAR_SUFFIXES = [
  ".agent-raw.json",
  ".trace.json",
  ".assertion-log.json",
  ".run-meta.json",
  ".session.jsonl",
  ".infra.stdout",
  ".stdout",
  ".stderr",
];

function isSidecarFile(name) {
  return SIDECAR_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function parseArgs(argv) {
  const args = {
    resultsDir: "",
    auditsDir: "",
    logsDir: "",
    overwrite: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--results-dir") args.resultsDir = argv[++i];
    else if (arg === "--audits-dir") args.auditsDir = argv[++i];
    else if (arg === "--logs-dir") args.logsDir = argv[++i];
    else if (arg === "--overwrite") args.overwrite = true;
  }

  return args;
}

function canonicalResultBase(fileName) {
  return basename(fileName, extname(fileName))
    .replace(/\.stdout$/i, "")
    .replace(/\.stderr$/i, "");
}

function extractEvalResult(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && typeof parsed.highest_gate === "number") {
      return parsed;
    }
  } catch {
    // Fall through to line-based extraction.
  }

  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line.endsWith("}")) continue;
    const start = line.indexOf("{");
    if (start < 0) continue;
    const candidate = line.slice(start);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && typeof parsed.highest_gate === "number") {
        return parsed;
      }
    } catch {
      // Keep scanning up.
    }
  }

  return null;
}

function resolveResultsDir(inputPath) {
  const envDir = process.env.DEC_BENCH_RESULTS_DIR?.trim();
  if (envDir && existsSync(resolve(envDir))) return resolve(envDir);

  const candidates = [
    "results",
    "../../results",
    inputPath,
    "data/results",
    "apps/web/data/results",
  ];

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (existsSync(resolved)) return resolved;
  }

  return resolve("apps/web/data/results");
}

function safeTimestampFromName(name) {
  const match = name.match(/(\d{10,})$/);
  if (!match) return new Date(0).toISOString();
  const seconds = Number(match[1]);
  const date = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(0);
  return date.toISOString();
}

function loadResults(resultsDir) {
  if (!existsSync(resultsDir)) return [];

  const stack = [resultsDir];
  const output = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (
        !entry.name.endsWith(".json") &&
        !entry.name.endsWith(".stdout.log") &&
        !/-run\d*\.log$/i.test(entry.name)
      ) {
        continue;
      }
      if (isSidecarFile(entry.name)) continue;
      const raw = readFileSync(absolute, "utf8");
      const parsed = extractEvalResult(raw);
      if (!parsed) continue;
      output.push({
        fileName: entry.name,
        fileDir: dirname(absolute),
        parsed,
      });
    }
  }

  return output;
}

function detectRunId(fileName, result) {
  if (typeof result.run_id === "string" && result.run_id.trim()) return result.run_id.trim();
  return canonicalResultBase(fileName);
}

function sidecarPath(resultDir, resultFileName, extension) {
  const base = canonicalResultBase(resultFileName);
  return join(resultDir, `${base}.${extension}`);
}

function inferScenarioId(fileName, result) {
  const raw = typeof result.scenario === "string" ? result.scenario.trim() : "";
  if (raw && raw !== "unknown") return raw;
  const base = canonicalResultBase(fileName).replace(/-run\d*$/i, "");
  const baseRtMarker = base.indexOf(".base-rt");
  if (baseRtMarker > 0) return base.slice(0, baseRtMarker);
  return base;
}

function createManifest(result, scenario, runId, stdoutBytes, extraLogs) {
  const logs = [
    {
      id: "stdout",
      label: "Run stdout",
      kind: "stdout",
      relativePath: "stdout.log",
      bytes: stdoutBytes,
      compression: "none",
    },
    ...extraLogs,
  ];

  return {
    schemaVersion: "1",
    runId,
    scenario,
    timestamp: typeof result.created_at === "string" ? result.created_at : safeTimestampFromName(runId),
    harness: String(result.harness ?? "unknown"),
    agent: String(result.agent ?? "unknown"),
    model: String(result.model ?? "unknown"),
    version: String(result.version ?? "unknown"),
    runMetadata:
      result.run_metadata && typeof result.run_metadata === "object"
        ? result.run_metadata
        : undefined,
    highestGate: Number(result.highest_gate ?? 0),
    normalizedScore: Number(result.normalized_score ?? 0),
    efficiency: result.efficiency ?? {
      wallClockSeconds: 0,
      agentSteps: 0,
      tokensUsed: 0,
      llmApiCostUsd: 0,
    },
    gates: result.gates ?? {},
    logs,
    traceSummary:
      result.trace_summary && typeof result.trace_summary === "object"
        ? result.trace_summary
        : undefined,
    notes: [
      "Bundle generated by apps/web/scripts/export-audit-bundles.mjs",
      "Uses run stdout/stderr sidecars when available; otherwise falls back to placeholder stdout.",
    ],
  };
}

function formatPlaceholderStdout(result, fileName) {
  return [
    `[audit-export] placeholder stdout for ${fileName}`,
    `[scenario] ${String(result.scenario ?? "unknown")}`,
    `[harness] ${String(result.harness ?? "unknown")}`,
    `[agent] ${String(result.agent ?? "unknown")}`,
    `[model] ${String(result.model ?? "unknown")}`,
    "",
    "No captured container stdout was found for this historical run artifact.",
    "Replace this file with the full run stdout to complete the audit bundle.",
    "",
    "Result JSON snapshot:",
    JSON.stringify(result, null, 2),
    "",
  ].join("\n");
}

function collectExtraLogs(logsDir, runId) {
  if (!logsDir || !existsSync(logsDir)) return [];
  const extra = [];
  const basePath = resolve(logsDir, runId);
  const direct = `${basePath}.log`;
  if (existsSync(direct)) {
    extra.push({
      id: "runtime",
      label: "Runtime log",
      kind: "service",
      relativePath: "logs/runtime.log",
      bytes: statSync(direct).size,
      compression: "none",
      sourcePath: direct,
    });
  }
  return extra;
}

function main() {
  const args = parseArgs(process.argv);
  const resultsDir = resolveResultsDir(args.resultsDir);
  const runtimeResultsDir = resolve("..", "..", "results");
  const defaultAuditsDir = existsSync(runtimeResultsDir)
    ? resolve(runtimeResultsDir, "audits")
    : resolve("apps/web/data/audits");
  const auditsDir = args.auditsDir ? resolve(args.auditsDir) : defaultAuditsDir;
  const logsDir = args.logsDir ? resolve(args.logsDir) : "";

  mkdirSync(auditsDir, { recursive: true });
  const results = loadResults(resultsDir);
  const indexByScenario = new Map();

  for (const { fileName, fileDir, parsed } of results) {
    const scenario = inferScenarioId(fileName, parsed);
    if (!scenario) continue;
    const runId = detectRunId(fileName, parsed);
    const runDir = join(auditsDir, scenario, runId);
    const stdoutPath = join(runDir, "stdout.log");
    const logsSubdir = join(runDir, "logs");
    const manifestPath = join(runDir, "manifest.json");

    if (existsSync(manifestPath) && !args.overwrite) {
      continue;
    }

    mkdirSync(logsSubdir, { recursive: true });

    const resultStdoutPath = sidecarPath(fileDir, fileName, "stdout");
    if (existsSync(resultStdoutPath)) {
      writeFileSync(stdoutPath, readFileSync(resultStdoutPath));
    } else {
      const placeholderStdout = formatPlaceholderStdout(parsed, fileName);
      writeFileSync(stdoutPath, placeholderStdout, "utf8");
    }
    const stdoutBytes = statSync(stdoutPath).size;

    const extraLogs = collectExtraLogs(logsDir, runId);
    const resultInfraStdoutPath = sidecarPath(fileDir, fileName, "infra.stdout");
    if (existsSync(resultInfraStdoutPath)) {
      extraLogs.push({
        id: "infra",
        label: "Infra stdout",
        kind: "system",
        relativePath: "logs/infra.stdout.log",
        bytes: statSync(resultInfraStdoutPath).size,
        compression: "none",
        sourcePath: resultInfraStdoutPath,
      });
    }

    const resultTracePath = sidecarPath(fileDir, fileName, "trace.json");
    if (existsSync(resultTracePath)) {
      extraLogs.push({
        id: "trace",
        label: "Agent trace",
        kind: "trace",
        relativePath: "logs/trace.json",
        bytes: statSync(resultTracePath).size,
        compression: "none",
        sourcePath: resultTracePath,
      });
      try {
        const traceRaw = readFileSync(resultTracePath, "utf8");
        const traceParsed = JSON.parse(traceRaw);
        if (traceParsed?.summary && typeof traceParsed.summary === "object") {
          parsed.trace_summary = traceParsed.summary;
        }
      } catch {
        // ignore malformed trace payloads
      }
    }

    const resultAgentRawPath = sidecarPath(fileDir, fileName, "agent-raw.json");
    if (existsSync(resultAgentRawPath)) {
      extraLogs.push({
        id: "agent_raw",
        label: "Agent raw JSON",
        kind: "system",
        relativePath: "logs/agent-raw.json",
        bytes: statSync(resultAgentRawPath).size,
        compression: "none",
        sourcePath: resultAgentRawPath,
      });
    }

    const resultSessionJsonlPath = sidecarPath(fileDir, fileName, "session.jsonl");
    if (existsSync(resultSessionJsonlPath)) {
      extraLogs.push({
        id: "session_jsonl",
        label: "Session JSONL",
        kind: "system",
        relativePath: "logs/session.jsonl",
        bytes: statSync(resultSessionJsonlPath).size,
        compression: "none",
        sourcePath: resultSessionJsonlPath,
      });
    }

    const resultRunMetaPath = sidecarPath(fileDir, fileName, "run-meta.json");
    if (existsSync(resultRunMetaPath)) {
      try {
        const runMetaRaw = readFileSync(resultRunMetaPath, "utf8");
        const runMetaParsed = JSON.parse(runMetaRaw);
        if (runMetaParsed && typeof runMetaParsed === "object") {
          parsed.run_metadata = runMetaParsed;
        }
      } catch {
        // ignore malformed run metadata payloads
      }
    }

    const resultStderrPath = sidecarPath(fileDir, fileName, "stderr");
    if (existsSync(resultStderrPath)) {
      extraLogs.push({
        id: "stderr",
        label: "Run stderr",
        kind: "stderr",
        relativePath: "logs/stderr.log",
        bytes: statSync(resultStderrPath).size,
        compression: "none",
        sourcePath: resultStderrPath,
      });
    }

    const resultAssertionLogPath = sidecarPath(fileDir, fileName, "assertion-log.json");
    if (existsSync(resultAssertionLogPath)) {
      extraLogs.push({
        id: "assertion_log",
        label: "Assertion Log",
        kind: "system",
        relativePath: "logs/assertion-log.json",
        bytes: statSync(resultAssertionLogPath).size,
        compression: "none",
        sourcePath: resultAssertionLogPath,
      });
    }
    for (const log of extraLogs) {
      const targetPath = join(runDir, log.relativePath);
      const targetDir = targetPath.slice(0, targetPath.lastIndexOf("/"));
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(targetPath, readFileSync(log.sourcePath));
    }

    const manifest = createManifest(
      parsed,
      scenario,
      runId,
      stdoutBytes,
      extraLogs.map(({ sourcePath, ...rest }) => rest),
    );
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const scenarioIndex = indexByScenario.get(scenario) ?? [];
    scenarioIndex.push({
      runId,
      scenario,
      timestamp: manifest.timestamp,
      harness: manifest.harness,
      agent: manifest.agent,
      model: manifest.model,
      version: manifest.version,
      highestGate: manifest.highestGate,
      normalizedScore: manifest.normalizedScore,
      availableLogs: manifest.logs.length,
    });
    indexByScenario.set(scenario, scenarioIndex);
  }

  for (const [scenario, runs] of indexByScenario.entries()) {
    runs.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const indexPath = join(auditsDir, scenario, "index.json");
    const payload = {
      schemaVersion: "1",
      scenario,
      runs,
    };
    writeFileSync(indexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(`Exported audit bundles for ${indexByScenario.size} scenario(s).`);
}

main();
