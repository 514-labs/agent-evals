import type { EvalResult } from "@/data/results";

const GATE_NAMES = ["G1 Functional", "G2 Correct", "G3 Robust", "G4 Performant", "G5 Production"];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function formatAgent(agent: string): string {
  return agent
    .replace("claude-code", "Claude-Code")
    .replace("codex", "Codex")
    .replace("cursor", "Cursor");
}

export const AGENT_LABELS: Record<string, string> = {
  "Claude-Code": "Claude Code",
  Codex: "Codex",
  Cursor: "Cursor",
};

// Gate Attrition: % of scenarios each agent cleared per gate
export type GateAttritionPoint = { gate: string } & Record<string, number | string>;

export function computeGateAttrition(entries: EvalResult[]): GateAttritionPoint[] {
  const byAgent = new Map<string, EvalResult[]>();
  for (const e of entries) {
    const arr = byAgent.get(e.agent) ?? [];
    arr.push(e);
    byAgent.set(e.agent, arr);
  }

  return GATE_NAMES.map((gateName, gateIdx) => {
    const gateLevel = gateIdx + 1;
    const point: GateAttritionPoint = { gate: gateName };
    for (const [agent, runs] of byAgent) {
      const cleared = runs.filter((r) => r.highest_gate >= gateLevel).length;
      point[formatAgent(agent)] = Math.round((cleared / runs.length) * 100);
    }
    return point;
  });
}

export function getAgentNames(entries: EvalResult[]): string[] {
  return [...new Set(entries.map((e) => formatAgent(e.agent)))];
}

// Cost vs Score scatter
export type CostScorePoint = {
  cost: number;
  score: number;
  agent: string;
  scenario: string;
  highestGate: number;
};

export function computeCostScore(entries: EvalResult[]): CostScorePoint[] {
  return entries
    .filter((e) => e.efficiency.llmApiCostUsd > 0)
    .map((e) => ({
      cost: e.efficiency.llmApiCostUsd,
      score: e.normalized_score,
      agent: formatAgent(e.agent),
      scenario: e.scenario,
      highestGate: e.highest_gate,
    }));
}

// Lift chart: per agent, median score+cost for two harness conditions
export type LiftPoint = {
  agent: string;
  baseScore: number;
  baseCost: number;
  specScore: number;
  specCost: number;
};

export function computeLiftData(entries: EvalResult[], baseHarness: string, specHarness: string): LiftPoint[] {
  const agents = [...new Set(entries.map((e) => e.agent))];
  return agents
    .map((agent) => {
      const baseRuns = entries.filter((e) => e.agent === agent && e.harness === baseHarness);
      const specRuns = entries.filter((e) => e.agent === agent && e.harness === specHarness);
      if (baseRuns.length === 0 || specRuns.length === 0) return null;
      return {
        agent: formatAgent(agent),
        baseScore: median(baseRuns.map((r) => r.normalized_score)),
        baseCost: median(baseRuns.map((r) => r.efficiency.llmApiCostUsd)),
        specScore: median(specRuns.map((r) => r.normalized_score)),
        specCost: median(specRuns.map((r) => r.efficiency.llmApiCostUsd)),
      };
    })
    .filter((p): p is LiftPoint => p !== null);
}

// Harness / Persona lift bars
export type LiftBarData = {
  agent: string;
  before: number;
  after: number;
  delta: number;
};

export function computeHarnessLift(entries: EvalResult[], baseHarness: string, specHarness: string): LiftBarData[] {
  const agents = [...new Set(entries.map((e) => e.agent))];
  return agents
    .map((agent) => {
      const baseScores = entries.filter((e) => e.agent === agent && e.harness === baseHarness).map((e) => e.normalized_score);
      const specScores = entries.filter((e) => e.agent === agent && e.harness === specHarness).map((e) => e.normalized_score);
      if (baseScores.length === 0 || specScores.length === 0) return null;
      const before = median(baseScores);
      const after = median(specScores);
      const delta = before > 0 ? Math.round(((after - before) / before) * 100) : 0;
      return { agent: formatAgent(agent), before, after, delta };
    })
    .filter((d): d is LiftBarData => d !== null);
}

export function computePersonaLift(entries: EvalResult[]): LiftBarData[] {
  const agents = [...new Set(entries.map((e) => e.agent))];
  return agents
    .map((agent) => {
      const naiveScores = entries
        .filter((e) => e.agent === agent && e.run_metadata?.persona === "baseline")
        .map((e) => e.normalized_score);
      const savvyScores = entries
        .filter((e) => e.agent === agent && e.run_metadata?.persona === "savvy")
        .map((e) => e.normalized_score);
      if (naiveScores.length === 0 || savvyScores.length === 0) return null;
      const before = median(naiveScores);
      const after = median(savvyScores);
      const delta = before > 0 ? Math.round(((after - before) / before) * 100) : 0;
      return { agent: formatAgent(agent), before, after, delta };
    })
    .filter((d): d is LiftBarData => d !== null);
}

// Efficiency table
export type EfficiencyRow = {
  agent: string;
  medianCost: number;
  medianTokens: number;
  medianTime: number;
};

export function computeEfficiency(entries: EvalResult[]): EfficiencyRow[] {
  const agents = [...new Set(entries.map((e) => e.agent))];
  return agents.map((agent) => {
    const runs = entries.filter((e) => e.agent === agent);
    return {
      agent: formatAgent(agent),
      medianCost: median(runs.map((r) => r.efficiency.llmApiCostUsd)),
      medianTokens: median(runs.map((r) => r.efficiency.tokensUsed)),
      medianTime: median(runs.map((r) => r.efficiency.wallClockSeconds)),
    };
  });
}
