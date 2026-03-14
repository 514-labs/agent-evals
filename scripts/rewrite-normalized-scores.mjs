#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CHECK_MODE = process.argv.includes("--check");
const GATE_ORDER = ["functional", "correct", "robust", "performant", "production"];
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

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function countPassedAssertions(resultMap) {
  return Object.values(resultMap ?? {}).filter(Boolean).length;
}

function countAssertions(resultMap) {
  return Object.keys(resultMap ?? {}).length;
}

function recalculateNormalizedScore(highestGate, gates, fallbackScore = 0) {
  const normalizedHighestGate = Number(highestGate ?? 0);
  if (normalizedHighestGate >= GATE_ORDER.length) {
    return 1;
  }

  const failedGateName = GATE_ORDER[normalizedHighestGate];
  const failedGate = gates?.[failedGateName];
  if (!failedGate) {
    return clamp(Number(fallbackScore ?? 0));
  }

  const passedAssertions =
    countPassedAssertions(failedGate.core) + countPassedAssertions(failedGate.scenario);
  const totalAssertions = countAssertions(failedGate.core) + countAssertions(failedGate.scenario);
  if (totalAssertions === 0) {
    return clamp(Number(fallbackScore ?? 0));
  }

  return clamp((normalizedHighestGate + passedAssertions / totalAssertions) / GATE_ORDER.length);
}

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

function rewriteResultFiles(filePaths, changedFiles) {
  const scoreByRunId = new Map();
  const scoreByFile = new Map();

  for (const relativePath of filePaths) {
    const parsed = readJson(relativePath);
    if (typeof parsed?.highest_gate !== "number" || !parsed?.gates) {
      continue;
    }

    const nextScore = recalculateNormalizedScore(
      parsed.highest_gate,
      parsed.gates,
      parsed.normalized_score,
    );
    if (parsed.normalized_score !== nextScore) {
      parsed.normalized_score = nextScore;
      markChanged(changedFiles, relativePath, () => writeJson(relativePath, parsed));
    }

    if (typeof parsed.run_id === "string" && parsed.run_id.trim()) {
      scoreByRunId.set(parsed.run_id.trim(), nextScore);
    }
    scoreByFile.set(relativePath, nextScore);
  }

  return { scoreByRunId, scoreByFile };
}

function rewriteManifestFiles(filePaths, scoreByRunId, changedFiles) {
  const scoreByScenarioRun = new Map();

  for (const relativePath of filePaths) {
    const parsed = readJson(relativePath);
    if (typeof parsed?.highestGate !== "number" || !parsed?.gates) {
      continue;
    }

    const nextScore = recalculateNormalizedScore(
      parsed.highestGate,
      parsed.gates,
      parsed.normalizedScore,
    );
    if (parsed.normalizedScore !== nextScore) {
      parsed.normalizedScore = nextScore;
      markChanged(changedFiles, relativePath, () => writeJson(relativePath, parsed));
    }

    const key = `${parsed.scenario}:${parsed.runId}`;
    scoreByScenarioRun.set(key, nextScore);
    if (typeof parsed.runId === "string" && parsed.runId.trim()) {
      scoreByRunId.set(parsed.runId.trim(), nextScore);
    }
  }

  return scoreByScenarioRun;
}

function rewriteIndexFiles(filePaths, scoreByScenarioRun, changedFiles) {
  for (const relativePath of filePaths) {
    const parsed = readJson(relativePath);
    if (parsed?.schemaVersion !== "1" || !Array.isArray(parsed?.runs)) {
      continue;
    }

    let changed = false;
    for (const run of parsed.runs) {
      const key = `${run.scenario}:${run.runId}`;
      const nextScore = scoreByScenarioRun.get(key);
      if (typeof nextScore === "number" && run.normalizedScore !== nextScore) {
        run.normalizedScore = nextScore;
        changed = true;
      }
    }

    if (changed) {
      markChanged(changedFiles, relativePath, () => writeJson(relativePath, parsed));
    }
  }
}

function rewriteSummaryJson(relativePath, scoreByRunId, scoreByFile, changedFiles) {
  const parsed = readJson(relativePath);
  if (!Array.isArray(parsed)) {
    return;
  }

  let changed = false;
  for (const entry of parsed) {
    const nextScore =
      scoreByFile.get(String(entry.file ?? "")) ?? scoreByRunId.get(String(entry.run_id ?? ""));
    if (typeof nextScore === "number" && entry.normalized_score !== nextScore) {
      entry.normalized_score = nextScore;
      changed = true;
    }
  }

  if (changed) {
    markChanged(changedFiles, relativePath, () => writeJson(relativePath, parsed));
  }
}

function rewriteSummaryCsv(relativePath, scoreByRunId, scoreByFile, changedFiles) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const lines = readFileSync(absolutePath, "utf8").trimEnd().split("\n");
  if (lines.length <= 1) {
    return;
  }

  const header = lines[0].split(",");
  const runIdIndex = header.indexOf("run_id");
  const fileIndex = header.indexOf("file");
  const scoreIndex = header.indexOf("normalized_score");
  if (runIdIndex < 0 || fileIndex < 0 || scoreIndex < 0) {
    return;
  }

  const nextLines = [lines[0]];
  let changed = false;
  for (const line of lines.slice(1)) {
    const columns = line.split(",");
    const nextScore =
      scoreByFile.get(columns[fileIndex] ?? "") ?? scoreByRunId.get(columns[runIdIndex] ?? "");
    if (typeof nextScore === "number") {
      const formatted = Number.isInteger(nextScore) ? nextScore.toFixed(1) : String(nextScore);
      if (columns[scoreIndex] !== formatted) {
        columns[scoreIndex] = formatted;
        changed = true;
      }
    }
    nextLines.push(columns.join(","));
  }

  if (changed) {
    markChanged(changedFiles, relativePath, () =>
      writeFileSync(absolutePath, `${nextLines.join("\n")}\n`, "utf8"),
    );
  }
}

function main() {
  const changedFiles = new Set();
  const trackedFiles = listTrackedFiles();
  const resultFiles = trackedFiles.filter(
    (relativePath) =>
      relativePath.endsWith(".json") &&
      !relativePath.includes("/audits/") &&
      !relativePath.endsWith("-summary.json") &&
      !SIDECAR_SUFFIXES.some((suffix) => relativePath.endsWith(suffix)),
  );
  const manifestFiles = trackedFiles.filter((relativePath) => relativePath.endsWith("/manifest.json"));
  const indexFiles = trackedFiles.filter((relativePath) => relativePath.endsWith("/index.json"));

  const { scoreByRunId, scoreByFile } = rewriteResultFiles(resultFiles, changedFiles);
  const scoreByScenarioRun = rewriteManifestFiles(manifestFiles, scoreByRunId, changedFiles);
  rewriteIndexFiles(indexFiles, scoreByScenarioRun, changedFiles);
  rewriteSummaryJson(
    "results/initial-benchmark-batch-summary.json",
    scoreByRunId,
    scoreByFile,
    changedFiles,
  );
  rewriteSummaryCsv(
    "results/initial-benchmark-batch-summary.csv",
    scoreByRunId,
    scoreByFile,
    changedFiles,
  );

  if (CHECK_MODE && changedFiles.size > 0) {
    console.error("Normalized scores are out of sync in tracked artifacts:");
    for (const relativePath of [...changedFiles].sort((a, b) => a.localeCompare(b))) {
      console.error(`- ${relativePath}`);
    }
    process.exitCode = 1;
  }
}

main();
