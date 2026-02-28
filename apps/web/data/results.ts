import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  version: string;
  harness: string;
  agent: string;
  model: string;
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

function resolveResultsDir(): string {
  const localDir = join(process.cwd(), "data", "results");
  if (existsSync(localDir)) return localDir;

  return join(process.cwd(), "apps", "web", "data", "results");
}

function loadResults(): EvalResult[] {
  const dir = resolveResultsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const results: EvalResult[] = [];

  for (const fileName of files) {
    try {
      const raw = readFileSync(join(dir, fileName), "utf8");
      const parsed = JSON.parse(raw) as EvalResult;
      if (parsed.scenario && typeof parsed.highest_gate === "number") {
        results.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return results;
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
