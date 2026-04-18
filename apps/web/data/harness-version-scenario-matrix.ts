/**
 * Moose Docker-less harness revisions (baseline, v2–v5) × scenario outcomes.
 * Em dash (—) denotes no run / not applicable.
 */

export type HarnessMatrixRow = {
  scenario: string;
  persona: string;
  gate: string;
  score: string;
  time: string;
  cost: string;
  turns: string;
  stop: string;
};

export const HARNESS_MATRIX_MDASH = "\u2014";

const MDASH = HARNESS_MATRIX_MDASH;

/** Checklist size for this matrix; gate strings use `passed/total` (e.g. 5/5). */
export const HARNESS_MATRIX_GATE_MAX = 5;

export type ParsedHarnessPoint = {
  persona: string;
  score: number;
  /** Count of checklist checks passed (numerator of gate, 0–`gateTotal`). */
  gatePassed: number;
  /** Checklist size (denominator of gate); scenarios here use 5. */
  gateTotal: number;
  timeSec: number;
  costUsd: number;
  turns: number;
};

function parseCostUsd(s: string): number | null {
  if (s === MDASH) return null;
  const m = s.match(/\$([\d.]+)/);
  return m ? parseFloat(m[1]!) : null;
}

function parseTimeSec(s: string): number | null {
  if (s === MDASH) return null;
  const m = s.match(/^(\d+)s$/);
  return m ? parseInt(m[1]!, 10) : null;
}

function parseScoreNum(s: string): number | null {
  if (s === MDASH) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseTurns(s: string): number | null {
  if (s === MDASH) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** Parses `5/5`, `1/5`, etc. Null if missing or malformed. */
export function parseGateParts(s: string): { passed: number; total: number } | null {
  if (s === MDASH) return null;
  const m = s.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const passed = parseInt(m[1]!, 10);
  const total = parseInt(m[2]!, 10);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(passed) || passed < 0 || passed > total) return null;
  return { passed, total };
}

/** Row with score, gate, cost, time, and turns present (excludes harness rows with no run). */
export function parseHarnessMatrixRow(row: HarnessMatrixRow): ParsedHarnessPoint | null {
  const costUsd = parseCostUsd(row.cost);
  const timeSec = parseTimeSec(row.time);
  const score = parseScoreNum(row.score);
  const turns = parseTurns(row.turns);
  const gate = parseGateParts(row.gate);
  if (costUsd === null || timeSec === null || score === null || turns === null || gate === null) return null;
  return {
    persona: row.persona,
    score,
    gatePassed: gate.passed,
    gateTotal: gate.total,
    timeSec,
    costUsd,
    turns,
  };
}

export const HARNESS_MATRIX_SCENARIO_ORDER = [
  "create-analytics-table",
  "csv-ingest",
  "mv-access-patterns",
  "ingest-to-api",
  "full-olap-pipeline",
] as const;

export function harnessMatrixPointsByScenario(): Map<string, ParsedHarnessPoint[]> {
  const map = new Map<string, ParsedHarnessPoint[]>();
  for (const row of HARNESS_VERSION_SCENARIO_MATRIX) {
    const p = parseHarnessMatrixRow(row);
    if (!p) continue;
    const list = map.get(row.scenario);
    if (list) list.push(p);
    else map.set(row.scenario, [p]);
  }
  return map;
}

export const HARNESS_VERSION_SCENARIO_MATRIX: HarnessMatrixRow[] = [
  {
    scenario: "create-analytics-table",
    persona: "baseline",
    gate: "5/5",
    score: "1.00",
    time: "180s",
    cost: "$0.50",
    turns: "37",
    stop: "success",
  },
  {
    scenario: "create-analytics-table",
    persona: "v2",
    gate: MDASH,
    score: MDASH,
    time: MDASH,
    cost: MDASH,
    turns: MDASH,
    stop: MDASH,
  },
  {
    scenario: "create-analytics-table",
    persona: "v3",
    gate: "5/5",
    score: "1.00",
    time: "154s",
    cost: "$0.41",
    turns: "32",
    stop: "success",
  },
  {
    scenario: "create-analytics-table",
    persona: "v4",
    gate: "5/5",
    score: "1.00",
    time: "152s",
    cost: "$0.35",
    turns: "28",
    stop: "success",
  },
  {
    scenario: "create-analytics-table",
    persona: "v5",
    gate: "5/5",
    score: "1.00",
    time: "170s",
    cost: "$0.44",
    turns: "36",
    stop: "success",
  },
  {
    scenario: "csv-ingest",
    persona: "baseline",
    gate: "1/5",
    score: "0.33",
    time: "415s",
    cost: "$1.37",
    turns: "85",
    stop: "success",
  },
  {
    scenario: "csv-ingest",
    persona: "v2",
    gate: "1/5",
    score: "0.33",
    time: "186s",
    cost: "$0.49",
    turns: "42",
    stop: "success",
  },
  {
    scenario: "csv-ingest",
    persona: "v3",
    gate: "1/5",
    score: "0.33",
    time: "184s",
    cost: "$0.50",
    turns: "33",
    stop: "success",
  },
  {
    scenario: "csv-ingest",
    persona: "v4",
    gate: "5/5",
    score: "1.00",
    time: "231s",
    cost: "$0.67",
    turns: "52",
    stop: "success",
  },
  {
    scenario: "csv-ingest",
    persona: "v5",
    gate: "5/5",
    score: "1.00",
    time: "161s",
    cost: "$0.43",
    turns: "35",
    stop: "success",
  },
  {
    scenario: "mv-access-patterns",
    persona: "baseline",
    gate: "5/5",
    score: "1.00",
    time: "309s",
    cost: "$0.94",
    turns: "60",
    stop: "success",
  },
  {
    scenario: "mv-access-patterns",
    persona: "v2",
    gate: MDASH,
    score: MDASH,
    time: MDASH,
    cost: MDASH,
    turns: MDASH,
    stop: MDASH,
  },
  {
    scenario: "mv-access-patterns",
    persona: "v3",
    gate: MDASH,
    score: MDASH,
    time: MDASH,
    cost: MDASH,
    turns: MDASH,
    stop: MDASH,
  },
  {
    scenario: "mv-access-patterns",
    persona: "v4",
    gate: "2/5",
    score: "0.53",
    time: "342s",
    cost: "$0.85",
    turns: "59",
    stop: "success",
  },
  {
    scenario: "mv-access-patterns",
    persona: "v5",
    gate: "0/5",
    score: "0.08",
    time: "222s",
    cost: "$0.60",
    turns: "47",
    stop: "success",
  },
  {
    scenario: "ingest-to-api",
    persona: "baseline",
    gate: "0/5",
    score: "0.12",
    time: "382s",
    cost: "$1.25",
    turns: "71",
    stop: "success",
  },
  {
    scenario: "ingest-to-api",
    persona: "v2",
    gate: "0/5",
    score: "0.12",
    time: "525s",
    cost: "$1.92",
    turns: "97",
    stop: "success",
  },
  {
    scenario: "ingest-to-api",
    persona: "v3",
    gate: MDASH,
    score: MDASH,
    time: MDASH,
    cost: MDASH,
    turns: MDASH,
    stop: MDASH,
  },
  {
    scenario: "ingest-to-api",
    persona: "v4",
    gate: "1/5",
    score: "0.23",
    time: "529s",
    cost: "$2.13",
    turns: "101",
    stop: "error_max_turns",
  },
  {
    scenario: "ingest-to-api",
    persona: "v5",
    gate: "0/5",
    score: "0.12",
    time: "383s",
    cost: "$1.03",
    turns: "58",
    stop: "success",
  },
  {
    scenario: "full-olap-pipeline",
    persona: "baseline",
    gate: "0/5",
    score: "0.17",
    time: "691s",
    cost: "$2.12",
    turns: "97",
    stop: "success",
  },
  {
    scenario: "full-olap-pipeline",
    persona: "v2",
    gate: MDASH,
    score: MDASH,
    time: MDASH,
    cost: MDASH,
    turns: MDASH,
    stop: MDASH,
  },
  {
    scenario: "full-olap-pipeline",
    persona: "v3",
    gate: MDASH,
    score: MDASH,
    time: MDASH,
    cost: MDASH,
    turns: MDASH,
    stop: MDASH,
  },
  {
    scenario: "full-olap-pipeline",
    persona: "v4",
    gate: "0/5",
    score: "0.13",
    time: "558s",
    cost: "$1.76",
    turns: "101",
    stop: "error_max_turns",
  },
  {
    scenario: "full-olap-pipeline",
    persona: "v5",
    gate: "0/5",
    score: "0.13",
    time: "537s",
    cost: "$1.41",
    turns: "87",
    stop: "success",
  },
];
