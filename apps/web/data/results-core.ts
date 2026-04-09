import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { isCanonicalResultFile } from "./result-files";

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
    llmApiCostSource?: "agent-reported" | "derived-from-published-pricing";
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
};

export type LeaderboardEntry = EvalResult & {
  rank: number;
};

const DEFAULT_EFFICIENCY: EvalResult["efficiency"] = {
  wallClockSeconds: 0,
  agentSteps: 0,
  tokensUsed: 0,
  llmApiCostUsd: 0,
};

export function resolveResultsDir(): string | null {
  const explicitDir = process.env.DEC_BENCH_RESULTS_DIR?.trim();
  if (explicitDir && existsSync(explicitDir)) return explicitDir;

  const sampleCandidates = [
    join(process.cwd(), "data", "results"),
    join(process.cwd(), "apps", "web", "data", "results"),
  ];
  const sampleDir = sampleCandidates.find((candidate) => existsSync(candidate)) ?? null;
  const preferSampleData =
    process.env.DEC_BENCH_USE_SAMPLE_DATA === "1" || process.env.NODE_ENV === "production";
  if (preferSampleData && sampleDir) return sampleDir;

  const runtimeCandidates = [join(process.cwd(), "..", "..", "results"), join(process.cwd(), "results")];
  for (const candidate of runtimeCandidates) {
    if (existsSync(candidate)) return candidate;
  }

  if (sampleDir) return sampleDir;

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
    if (!isCanonicalResultFile(entry.name)) continue;
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

export function loadResults(): EvalResult[] {
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

export function deriveLeaderboardEntries(results: EvalResult[]): LeaderboardEntry[] {
  const sorted = [...results].sort((a, b) => {
    if (b.highest_gate !== a.highest_gate) {
      return b.highest_gate - a.highest_gate;
    }
    return b.normalized_score - a.normalized_score;
  });

  return sorted.map((result, index) => ({
    ...result,
    rank: index + 1,
  }));
}

export function deriveUniqueScenarios(results: EvalResult[]): string[] {
  return [...new Set(results.map((r) => r.scenario))].sort();
}

export function deriveUniqueHarnesses(results: EvalResult[]): string[] {
  return [...new Set(results.map((r) => r.harness))].sort();
}

export function deriveUniqueModels(results: EvalResult[]): string[] {
  return [...new Set(results.map((r) => r.model))].sort();
}

export function deriveUniquePersonas(results: EvalResult[]): string[] {
  return [
    ...new Set(
      results
        .filter((r) => r.run_metadata?.persona)
        .map((r) => r.run_metadata!.persona),
    ),
  ].sort();
}
