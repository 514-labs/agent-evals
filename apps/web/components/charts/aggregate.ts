import type { EvalResult } from "@/data/results";

const GATE_NAMES = ["G1 Functional", "G2 Correct", "G3 Robust", "G4 Performant", "G5 Production"];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function formatAgent(agent: string): string {
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

function formatModel(model: string): string {
  return model
    .replace("claude-opus-4-6", "Claude Opus 4.6")
    .replace("claude-sonnet-4-6", "Claude Sonnet 4.6")
    .replace("gpt-5.4", "GPT-5.4")
    .replace("composer-2", "Composer 2")
    .replace(/^composer$/, "Composer");
}

export const MODEL_LABELS: Record<string, string> = {
  "Claude Opus 4.6": "Claude Opus 4.6",
  "Claude Sonnet 4.6": "Claude Sonnet 4.6",
  "GPT-5.4": "GPT-5.4",
  "Composer 2": "Composer 2",
  Composer: "Composer",
};

const MODEL_ORDER = [
  "Claude Opus 4.6",
  "Claude Sonnet 4.6",
  "GPT-5.4",
  "Composer 2",
  "Composer",
];

export function getModelNames(entries: EvalResult[]): string[] {
  const names = [...new Set(entries.map((e) => formatModel(e.model)))];
  return names.sort((a, b) => {
    const ai = MODEL_ORDER.indexOf(a);
    const bi = MODEL_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export function computeGateAttritionByModel(
  entries: EvalResult[]
): GateAttritionPoint[] {
  const byModel = new Map<string, EvalResult[]>();
  for (const e of entries) {
    const key = formatModel(e.model);
    const arr = byModel.get(key) ?? [];
    arr.push(e);
    byModel.set(key, arr);
  }

  return GATE_NAMES.map((gateName, gateIdx) => {
    const gateLevel = gateIdx + 1;
    const point: GateAttritionPoint = { gate: gateName };
    for (const [model, runs] of byModel) {
      const cleared = runs.filter((r) => r.highest_gate >= gateLevel).length;
      point[model] = Math.round((cleared / runs.length) * 100);
    }
    return point;
  });
}

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

const AGENT_ORDER = ["Claude-Code", "Codex", "Cursor"];

export function getAgentNames(entries: EvalResult[]): string[] {
  const names = [...new Set(entries.map((e) => formatAgent(e.agent)))];
  return names.sort((a, b) => {
    const ai = AGENT_ORDER.indexOf(a);
    const bi = AGENT_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

// Cost vs Score scatter
export type CostScorePoint = {
  cost: number;
  time: number;
  score: number;
  agent: string;
  scenario: string;
  highestGate: number;
  tier: string;
};

export function computeCostScore(
  entries: EvalResult[],
  scenarioTiers: Record<string, string> = {},
): CostScorePoint[] {
  return entries
    .filter((e) => e.efficiency.llmApiCostUsd > 0)
    .map((e) => ({
      cost: e.efficiency.llmApiCostUsd,
      time: e.efficiency.wallClockSeconds,
      score: e.normalized_score,
      agent: formatAgent(e.agent),
      scenario: e.scenario,
      highestGate: e.highest_gate,
      tier: scenarioTiers[e.scenario] ?? "unknown",
    }));
}

// Lift chart: per agent, median score+cost for two harness conditions
export type LiftPoint = {
  agent: string;
  baseScore: number;
  baseCost: number;
  baseTime: number;
  baseN: number;
  specScore: number;
  specCost: number;
  specTime: number;
  specN: number;
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
        baseTime: median(baseRuns.map((r) => r.efficiency.wallClockSeconds)),
        baseN: baseRuns.length,
        specScore: median(specRuns.map((r) => r.normalized_score)),
        specCost: median(specRuns.map((r) => r.efficiency.llmApiCostUsd)),
        specTime: median(specRuns.map((r) => r.efficiency.wallClockSeconds)),
        specN: specRuns.length,
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

// Abstract summary statistics
export type AbstractStats = {
  totalRuns: number;
  g1PassRate: number;
  g5BestRate: number;
  medianCostMin: number;
  medianCostMax: number;
  costMultiple: number;
  medianTimeMinMinutes: number;
  medianTimeMaxMinutes: number;
  harnessLiftPct: number;
  harnessLiftP: number;
  agentHardP: number;
  easySpreadPp: number;
  hardSpreadPp: number;
  costP: number;
  timeP: number;
};

function assignAverageRanks(sorted: { v: number; rank: number }[]): void {
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j]!.v === sorted[i]!.v) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) sorted[k]!.rank = avgRank;
    i = j;
  }
}

function tieCorrection(sorted: { v: number }[]): number {
  let correction = 0;
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j]!.v === sorted[i]!.v) j++;
    const t = j - i;
    if (t > 1) correction += t * t * t - t;
    i = j;
  }
  return correction;
}

function mannWhitneyU(a: number[], b: number[]): { z: number; p: number } {
  const combined = [
    ...a.map((v) => ({ v, g: 0 as const, rank: 0 })),
    ...b.map((v) => ({ v, g: 1 as const, rank: 0 })),
  ].sort((x, y) => x.v - y.v);
  assignAverageRanks(combined);
  const sumA = combined
    .filter((c) => c.g === 0)
    .reduce((s, c) => s + c.rank, 0);
  const nA = a.length;
  const nB = b.length;
  const N = nA + nB;
  const U = sumA - (nA * (nA + 1)) / 2;
  const meanU = (nA * nB) / 2;
  const tc = tieCorrection(combined);
  const stdU = Math.sqrt(
    ((nA * nB) / 12) * (N + 1 - tc / (N * (N - 1)))
  );
  const z = stdU === 0 ? 0 : (U - meanU) / stdU;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { z, p };
}

function kruskalWallisP(groups: number[][]): number {
  const all: { v: number; g: number; rank: number }[] = [];
  groups.forEach((g, gi) =>
    g.forEach((v) => all.push({ v, g: gi, rank: 0 }))
  );
  all.sort((a, b) => a.v - b.v);
  assignAverageRanks(all);
  const N = all.length;
  let H = 0;
  groups.forEach((_g, gi) => {
    const ranks = all.filter((s) => s.g === gi).map((s) => s.rank);
    const ni = ranks.length;
    const Ri = ranks.reduce((s, v) => s + v, 0);
    H += (Ri * Ri) / ni;
  });
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  const tc = tieCorrection(all);
  if (tc > 0) H /= 1 - tc / (N * N * N - N);
  return Math.exp(-H / 2); // chi-sq df=2 survival
}

function normalCDF(x: number): number {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * ax);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
  return 0.5 * (1.0 + sign * y);
}

export function computeAbstractStats(entries: EvalResult[]): AbstractStats {
  const agents = [...new Set(entries.map((e) => e.agent))].sort();
  const scenarios = [...new Set(entries.map((e) => e.scenario))];
  const gateKeys: Array<keyof EvalResult["gates"]> = [
    "functional",
    "correct",
    "robust",
    "performant",
    "production",
  ];

  // G1 average pass rate across agents
  const g1Rates = agents.map((agent) => {
    const runs = entries.filter((e) => e.agent === agent);
    return runs.filter((r) => r.gates[gateKeys[0]!]?.passed).length / runs.length;
  });
  const g1PassRate = Math.round(
    (g1Rates.reduce((s, v) => s + v, 0) / g1Rates.length) * 100
  );

  // G5 best agent pass rate
  const g5Rates = agents.map((agent) => {
    const runs = entries.filter((e) => e.agent === agent);
    return runs.filter((r) => r.gates[gateKeys[4]!]?.passed).length / runs.length;
  });
  const g5BestRate = Math.round(Math.max(...g5Rates) * 100);

  // Median cost per agent
  const agentMedianCosts = agents.map((a) =>
    median(
      entries
        .filter((e) => e.agent === a && e.efficiency.llmApiCostUsd > 0)
        .map((e) => e.efficiency.llmApiCostUsd)
    )
  );
  const medianCostMin = Math.min(...agentMedianCosts);
  const medianCostMax = Math.max(...agentMedianCosts);
  const costMultiple = Math.round(medianCostMax / medianCostMin);

  // Median time per agent (minutes)
  const agentMedianTimes = agents.map((a) =>
    median(
      entries
        .filter((e) => e.agent === a && e.efficiency.wallClockSeconds > 0)
        .map((e) => e.efficiency.wallClockSeconds)
    )
  );
  const medianTimeMinMinutes =
    Math.round((Math.min(...agentMedianTimes) / 60) * 10) / 10;
  const medianTimeMaxMinutes =
    Math.round((Math.max(...agentMedianTimes) / 60) * 10) / 10;

  // Harness lift: per-agent median lift for effect size, stratified MWU for p
  const harnesses = [...new Set(entries.map((e) => e.harness))].sort();
  let harnessLiftPct = 0;
  let harnessLiftP = 1;
  if (harnesses.length >= 2) {
    const perAgentLifts = agents.map((agent) => {
      const baseScores = entries
        .filter((e) => e.agent === agent && e.harness === harnesses[0])
        .map((e) => e.normalized_score);
      const specScores = entries
        .filter((e) => e.agent === agent && e.harness === harnesses[1])
        .map((e) => e.normalized_score);
      if (baseScores.length === 0 || specScores.length === 0) return 0;
      return median(specScores) - median(baseScores);
    });
    harnessLiftPct =
      Math.round(
        Math.max(...perAgentLifts.map((l) => Math.abs(l))) * 1000
      ) / 10;
    // Stratified MWU: subtract per-agent means to control for agent confounding
    const agentMeans: Record<string, number> = {};
    for (const agent of agents) {
      const runs = entries.filter((e) => e.agent === agent);
      agentMeans[agent] =
        runs.reduce((s, r) => s + r.normalized_score, 0) / runs.length;
    }
    const baseResiduals = entries
      .filter((e) => e.harness === harnesses[0])
      .map((e) => e.normalized_score - (agentMeans[e.agent] ?? 0));
    const specResiduals = entries
      .filter((e) => e.harness === harnesses[1])
      .map((e) => e.normalized_score - (agentMeans[e.agent] ?? 0));
    harnessLiftP =
      Math.round(mannWhitneyU(baseResiduals, specResiduals).p * 100) / 100;
  }

  // Agent significance on hard scenarios
  const scenarioAvg: Record<string, number> = {};
  scenarios.forEach((s) => {
    const runs = entries.filter((e) => e.scenario === s);
    scenarioAvg[s] = runs.reduce((sum, r) => sum + r.normalized_score, 0) / runs.length;
  });
  const sortedScenarios = [...scenarios].sort(
    (a, b) => (scenarioAvg[a] ?? 0) - (scenarioAvg[b] ?? 0)
  );
  const midIdx = Math.floor(sortedScenarios.length / 2);
  const hardSet = new Set(sortedScenarios.slice(0, midIdx));

  let agentHardP = 1;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = entries
        .filter((e) => e.agent === agents[i] && hardSet.has(e.scenario))
        .map((e) => e.normalized_score);
      const b = entries
        .filter((e) => e.agent === agents[j] && hardSet.has(e.scenario))
        .map((e) => e.normalized_score);
      if (a.length >= 2 && b.length >= 2) {
        const { p } = mannWhitneyU(a, b);
        if (p < agentHardP) agentHardP = p;
      }
    }
  }
  agentHardP = Math.round(agentHardP * 100) / 100;

  // Per-scenario average spread between best and worst agent, then averaged
  function avgPerScenarioSpread(scenarioSet: Set<string>): number {
    const scenarioList = [...scenarioSet];
    const spreads = scenarioList.map((s) => {
      const agentScores = agents
        .map((agent) => {
          const runs = entries.filter(
            (e) => e.agent === agent && e.scenario === s
          );
          return runs.length > 0
            ? runs.reduce((sum, r) => sum + r.normalized_score, 0) /
                runs.length
            : null;
        })
        .filter((v): v is number => v !== null);
      if (agentScores.length < 2) return 0;
      return Math.max(...agentScores) - Math.min(...agentScores);
    });
    const avg = spreads.reduce((s, v) => s + v, 0) / spreads.length;
    return Math.round(avg * 100);
  }
  const easySet = new Set(sortedScenarios.slice(midIdx));
  const easySpreadPp = avgPerScenarioSpread(easySet);
  const hardSpreadPp = avgPerScenarioSpread(hardSet);

  // Cost and time Kruskal-Wallis p
  const costGroups = agents.map((a) =>
    entries
      .filter((e) => e.agent === a && e.efficiency.llmApiCostUsd > 0)
      .map((e) => e.efficiency.llmApiCostUsd)
  );
  const timeGroups = agents.map((a) =>
    entries
      .filter((e) => e.agent === a && e.efficiency.wallClockSeconds > 0)
      .map((e) => e.efficiency.wallClockSeconds)
  );
  const costP = Math.round(kruskalWallisP(costGroups) * 1000) / 1000;
  const timeP = Math.round(kruskalWallisP(timeGroups) * 1000) / 1000;

  return {
    totalRuns: entries.length,
    g1PassRate,
    g5BestRate,
    medianCostMin,
    medianCostMax,
    costMultiple,
    medianTimeMinMinutes,
    medianTimeMaxMinutes,
    harnessLiftPct,
    harnessLiftP,
    agentHardP,
    easySpreadPp,
    hardSpreadPp,
    costP,
    timeP,
  };
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

export type EfficiencyByGateRow = {
  agent: string;
  gates: { minGate: number; medianCost: number; medianTime: number; n: number }[];
};

export function computeEfficiencyByGate(entries: EvalResult[]): EfficiencyByGateRow[] {
  const agents = [...new Set(entries.map((e) => e.agent))];
  return agents.map((agent) => {
    const runs = entries.filter((e) => e.agent === agent);
    const gates = [0, 1, 2, 3, 4, 5].map((minGate) => {
      const filtered = runs.filter((r) => r.highest_gate >= minGate);
      return {
        minGate,
        medianCost: median(filtered.map((r) => r.efficiency.llmApiCostUsd)),
        medianTime: median(filtered.map((r) => r.efficiency.wallClockSeconds)),
        n: filtered.length,
      };
    });
    return { agent: formatAgent(agent), gates };
  });
}
