import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export type GateResult = {
  passed: boolean;
  score: number;
  core: Record<string, boolean>;
  scenario: Record<string, boolean>;
};

export type GateName =
  | "functional"
  | "correct"
  | "robust"
  | "performant"
  | "production";

export type EvalResult = {
  scenario: string;
  run_id?: string;
  result_file?: string;
  version: string;
  harness: string;
  agent: string;
  model: string;
  run_metadata?: {
    persona: string;
    planMode: string;
    promptPath: string;
    promptSha256: string;
    promptContent: string;
    promptPreview?: string;
  };
  highest_gate: number;
  normalized_score: number;
  composite_score?: {
    total: number;
    components: {
      taskCompletion: number;
      latency: number;
      cost: number;
      storage: number;
    };
  };
  gates: Record<GateName, GateResult>;
  efficiency: {
    wallClockSeconds: number;
    agentSteps: number;
    tokensUsed: number;
    llmApiCostUsd: number;
  };
};

export type LeaderboardEntry = EvalResult & {
  rank: number;
};

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

const DEFAULT_EFFICIENCY: EvalResult["efficiency"] = {
  wallClockSeconds: 0,
  agentSteps: 0,
  tokensUsed: 0,
  llmApiCostUsd: 0,
};

function isSidecarFile(name: string): boolean {
  return SIDECAR_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function resolveResultsDir(): string | null {
  const explicitDir = process.env.DEC_BENCH_RESULTS_DIR?.trim();
  if (explicitDir && existsSync(explicitDir)) return explicitDir;

  const runtimeCandidates = [join(process.cwd(), "..", "..", "results"), join(process.cwd(), "results")];
  for (const candidate of runtimeCandidates) {
    if (existsSync(candidate)) return candidate;
  }

  const useSampleData = process.env.DEC_BENCH_USE_SAMPLE_DATA === "1";
  if (!useSampleData) return runtimeCandidates[0] ?? null;

  const sampleCandidates = [join(process.cwd(), "data", "results"), join(process.cwd(), "apps", "web", "data", "results")];
  for (const candidate of sampleCandidates) {
    if (existsSync(candidate)) return candidate;
  }

  return runtimeCandidates[0] ?? null;
}

function collectResultFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectResultFiles(absolutePath));
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
    files.push(absolutePath);
  }

  return files;
}

function inferScenarioFromFileBase(baseName: string): string {
  const normalized = baseName
    .replace(/\.stdout$/i, "")
    .replace(/\.stderr$/i, "")
    .replace(/-run\d*$/i, "");

  if (normalized.includes(".base-rt")) {
    return normalized.split(".base-rt")[0] ?? normalized;
  }

  return normalized;
}

function extractEvalResult(raw: string): EvalResult | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  try {
    const parsed = JSON.parse(trimmed) as EvalResult;
    if (typeof parsed.highest_gate === "number") return parsed;
  } catch {
    // Fall through to line-based extraction.
  }

  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line.endsWith("}")) continue;

    const jsonStart = line.indexOf("{");
    if (jsonStart < 0) continue;

    const candidate = line.slice(jsonStart);
    try {
      const parsed = JSON.parse(candidate) as EvalResult;
      if (typeof parsed.highest_gate === "number") return parsed;
    } catch {
      continue;
    }
  }

  return null;
}

function loadResults(): EvalResult[] {
  const dir = resolveResultsDir();
  if (!dir || !existsSync(dir)) return [];

  const files = collectResultFiles(dir).sort((a, b) => a.localeCompare(b));

  const results: EvalResult[] = [];

  for (const filePath of files) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = extractEvalResult(raw);
      if (!parsed) continue;

      const fileName = basename(filePath);
      const baseName = fileName.replace(/\.json$/i, "").replace(/\.log$/i, "");
      const scenarioFromFile = inferScenarioFromFileBase(baseName);
      const scenario =
        typeof parsed.scenario === "string" && parsed.scenario !== "unknown"
          ? parsed.scenario
          : scenarioFromFile;
      const runId =
        typeof parsed.run_id === "string" && parsed.run_id.trim().length > 0
          ? parsed.run_id
          : baseName;

      if (scenario && typeof parsed.highest_gate === "number") {
        results.push({
          ...parsed,
          scenario,
          run_id: runId,
          result_file: fileName,
          efficiency: parsed.efficiency ?? DEFAULT_EFFICIENCY,
        });
      }
    } catch {
      continue;
    }
  }

  const deduped = new Map<string, EvalResult>();
  for (const result of results) {
    const key = `${result.scenario}:${result.run_id ?? result.result_file ?? "unknown"}`;
    if (!deduped.has(key)) deduped.set(key, result);
  }

  return [...deduped.values()];
}

export function getLeaderboardEntries(): LeaderboardEntry[] {
  const results = loadResults();

  results.sort((a, b) => {
    if (b.highest_gate !== a.highest_gate) {
      return b.highest_gate - a.highest_gate;
    }
    return b.normalized_score - a.normalized_score;
  });

  return results.map((result, index) => ({
    ...result,
    rank: index + 1,
  }));
}

export function getUniqueScenarios(): string[] {
  const results = loadResults();
  return [...new Set(results.map((r) => r.scenario))].sort();
}

export function getUniqueHarnesses(): string[] {
  const results = loadResults();
  return [...new Set(results.map((r) => r.harness))].sort();
}
