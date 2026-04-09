import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { EvalResult } from "@/data/results";
import {
  computeGateAttrition,
  computeCostScore,
  computeLiftData,
  computeHarnessLift,
  computePersonaLift,
  computeEfficiency,
  getAgentNames,
  AGENT_LABELS,
} from "./aggregate";

function makeEntry(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    scenario: "test-scenario",
    version: "v0.1.0",
    harness: "base-rt",
    agent: "claude-code",
    model: "claude-4",
    highest_gate: 3,
    normalized_score: 0.85,
    gates: {
      functional: { passed: true, score: 1, core: {}, scenario: {} },
      correct: { passed: true, score: 1, core: {}, scenario: {} },
      robust: { passed: true, score: 0.7, core: {}, scenario: {} },
      performant: { passed: false, score: 0, core: {}, scenario: {} },
      production: { passed: false, score: 0, core: {}, scenario: {} },
    },
    efficiency: {
      wallClockSeconds: 120,
      agentSteps: 5,
      tokensUsed: 50000,
      llmApiCostUsd: 0.25,
    },
    ...overrides,
  };
}

const meta = (persona: string) => ({
  persona,
  planMode: "no-plan",
  promptPath: "",
  promptSha256: "",
  promptContent: "",
});

// ─── getAgentNames ──────────────────────────────────────────

describe("getAgentNames", () => {
  test("returns formatted unique agent names", () => {
    const entries = [
      makeEntry({ agent: "claude-code" }),
      makeEntry({ agent: "codex" }),
      makeEntry({ agent: "cursor" }),
      makeEntry({ agent: "claude-code" }),
    ];
    assert.deepEqual(getAgentNames(entries), ["Claude-Code", "Codex", "Cursor"]);
  });

  test("returns empty array for empty input", () => {
    assert.deepEqual(getAgentNames([]), []);
  });

  test("handles single agent", () => {
    assert.deepEqual(getAgentNames([makeEntry({ agent: "codex" })]), ["Codex"]);
  });

  test("preserves unknown agent names verbatim", () => {
    const names = getAgentNames([makeEntry({ agent: "new-agent" })]);
    assert.deepEqual(names, ["new-agent"]);
  });
});

// ─── AGENT_LABELS ───────────────────────────────────────────

describe("AGENT_LABELS", () => {
  test("maps internal keys to display names", () => {
    assert.equal(AGENT_LABELS["Claude-Code"], "Claude Code");
    assert.equal(AGENT_LABELS["Codex"], "Codex");
    assert.equal(AGENT_LABELS["Cursor"], "Cursor");
  });
});

// ─── computeGateAttrition ───────────────────────────────────

describe("computeGateAttrition", () => {
  test("always returns 5 gate rows", () => {
    assert.equal(computeGateAttrition([]).length, 5);
    assert.equal(computeGateAttrition([makeEntry()]).length, 5);
  });

  test("gate labels are in order", () => {
    const result = computeGateAttrition([makeEntry()]);
    assert.equal(result[0]!.gate, "G1 Functional");
    assert.equal(result[1]!.gate, "G2 Correct");
    assert.equal(result[2]!.gate, "G3 Robust");
    assert.equal(result[3]!.gate, "G4 Performant");
    assert.equal(result[4]!.gate, "G5 Production");
  });

  test("computes correct attrition with mixed gate levels", () => {
    const entries = [
      makeEntry({ agent: "claude-code", highest_gate: 5 }),
      makeEntry({ agent: "claude-code", highest_gate: 3 }),
      makeEntry({ agent: "codex", highest_gate: 1 }),
      makeEntry({ agent: "codex", highest_gate: 2 }),
    ];
    const result = computeGateAttrition(entries);

    assert.equal(result[0]!["Claude-Code"], 100); // G1: 2/2
    assert.equal(result[2]!["Claude-Code"], 100); // G3: 2/2 (both >= 3)
    assert.equal(result[3]!["Claude-Code"], 50);  // G4: 1/2 (only gate-5)
    assert.equal(result[4]!["Claude-Code"], 50);  // G5: 1/2

    assert.equal(result[0]!["Codex"], 100); // G1: 2/2
    assert.equal(result[1]!["Codex"], 50);  // G2: 1/2
    assert.equal(result[2]!["Codex"], 0);   // G3: 0/2
  });

  test("agent clearing gate 0 shows 0% everywhere", () => {
    const entries = [makeEntry({ agent: "codex", highest_gate: 0 })];
    const result = computeGateAttrition(entries);
    for (let i = 0; i < 5; i++) {
      assert.equal(result[i]!["Codex"], 0);
    }
  });

  test("all agents clearing gate 5 shows 100% everywhere", () => {
    const entries = [
      makeEntry({ agent: "codex", highest_gate: 5 }),
      makeEntry({ agent: "codex", highest_gate: 5 }),
    ];
    const result = computeGateAttrition(entries);
    for (let i = 0; i < 5; i++) {
      assert.equal(result[i]!["Codex"], 100);
    }
  });

  test("single run per agent produces 0% or 100% only", () => {
    const entries = [makeEntry({ agent: "cursor", highest_gate: 3 })];
    const result = computeGateAttrition(entries);
    assert.equal(result[0]!["Cursor"], 100);
    assert.equal(result[1]!["Cursor"], 100);
    assert.equal(result[2]!["Cursor"], 100);
    assert.equal(result[3]!["Cursor"], 0);
    assert.equal(result[4]!["Cursor"], 0);
  });

  test("handles many agents across many scenarios", () => {
    const entries = [];
    for (let g = 1; g <= 5; g++) {
      entries.push(makeEntry({ agent: "codex", highest_gate: g, scenario: `s${g}` }));
    }
    const result = computeGateAttrition(entries);
    assert.equal(result[0]!["Codex"], 100);  // 5/5
    assert.equal(result[1]!["Codex"], 80);   // 4/5
    assert.equal(result[2]!["Codex"], 60);   // 3/5
    assert.equal(result[3]!["Codex"], 40);   // 2/5
    assert.equal(result[4]!["Codex"], 20);   // 1/5
  });
});

// ─── computeCostScore ───────────────────────────────────────

describe("computeCostScore", () => {
  test("includes highestGate for client-side filtering", () => {
    const entries = [
      makeEntry({ highest_gate: 3, normalized_score: 0.8, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.5 } }),
      makeEntry({ highest_gate: 1, normalized_score: 0.3, efficiency: { wallClockSeconds: 30, agentSteps: 1, tokensUsed: 500, llmApiCostUsd: 0.1 } }),
    ];
    const result = computeCostScore(entries);
    assert.equal(result.length, 2);
    assert.equal(result[0]!.highestGate, 3);
    assert.equal(result[0]!.cost, 0.5);
    assert.equal(result[0]!.score, 0.8);
    assert.equal(result[1]!.highestGate, 1);
  });

  test("excludes entries with zero cost", () => {
    const entries = [
      makeEntry({ efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0 } }),
    ];
    assert.equal(computeCostScore(entries).length, 0);
  });

  test("returns empty for empty input", () => {
    assert.equal(computeCostScore([]).length, 0);
  });

  test("preserves scenario name and agent label", () => {
    const entries = [makeEntry({ agent: "cursor", scenario: "foo-bar-csv-ingest" })];
    const result = computeCostScore(entries);
    assert.equal(result[0]!.agent, "Cursor");
    assert.equal(result[0]!.scenario, "foo-bar-csv-ingest");
  });

  test("handles very small and very large costs", () => {
    const entries = [
      makeEntry({ efficiency: { wallClockSeconds: 10, agentSteps: 1, tokensUsed: 100, llmApiCostUsd: 0.001 } }),
      makeEntry({ efficiency: { wallClockSeconds: 600, agentSteps: 10, tokensUsed: 5000000, llmApiCostUsd: 42.50 } }),
    ];
    const result = computeCostScore(entries);
    assert.equal(result.length, 2);
    assert.equal(result[0]!.cost, 0.001);
    assert.equal(result[1]!.cost, 42.50);
  });
});

// ─── computeLiftData ────────────────────────────────────────

describe("computeLiftData", () => {
  test("computes median score and cost per harness pair", () => {
    const entries = [
      makeEntry({ agent: "claude-code", harness: "base-rt", normalized_score: 0.7, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.2 } }),
      makeEntry({ agent: "claude-code", harness: "base-rt", normalized_score: 0.9, efficiency: { wallClockSeconds: 90, agentSteps: 1, tokensUsed: 2000, llmApiCostUsd: 0.4 } }),
      makeEntry({ agent: "claude-code", harness: "classic-de", normalized_score: 0.95, efficiency: { wallClockSeconds: 80, agentSteps: 1, tokensUsed: 1500, llmApiCostUsd: 0.3 } }),
    ];
    const result = computeLiftData(entries, "base-rt", "classic-de");
    assert.equal(result.length, 1);
    assert.equal(result[0]!.agent, "Claude-Code");
    assert.equal(result[0]!.baseScore, 0.8);
    assert.ok(Math.abs(result[0]!.baseCost - 0.3) < 0.001);
    assert.equal(result[0]!.specScore, 0.95);
    assert.equal(result[0]!.specCost, 0.3);
  });

  test("excludes agents missing one harness", () => {
    const entries = [makeEntry({ agent: "claude-code", harness: "base-rt" })];
    assert.equal(computeLiftData(entries, "base-rt", "classic-de").length, 0);
  });

  test("returns empty for empty input", () => {
    assert.equal(computeLiftData([], "base-rt", "classic-de").length, 0);
  });

  test("handles multiple agents with different harness coverage", () => {
    const entries = [
      makeEntry({ agent: "claude-code", harness: "base-rt", normalized_score: 0.8, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.2 } }),
      makeEntry({ agent: "claude-code", harness: "classic-de", normalized_score: 0.9, efficiency: { wallClockSeconds: 70, agentSteps: 1, tokensUsed: 1200, llmApiCostUsd: 0.3 } }),
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.6, efficiency: { wallClockSeconds: 100, agentSteps: 1, tokensUsed: 2000, llmApiCostUsd: 1.0 } }),
      // codex has no classic-de runs
    ];
    const result = computeLiftData(entries, "base-rt", "classic-de");
    assert.equal(result.length, 1);
    assert.equal(result[0]!.agent, "Claude-Code");
  });

  test("median with odd number of values picks middle", () => {
    const entries = [
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.5, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.1 } }),
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.7, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.3 } }),
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.9, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.5 } }),
      makeEntry({ agent: "codex", harness: "classic-de", normalized_score: 0.95, efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 1000, llmApiCostUsd: 0.2 } }),
    ];
    const result = computeLiftData(entries, "base-rt", "classic-de");
    assert.equal(result[0]!.baseScore, 0.7); // median of [0.5, 0.7, 0.9]
    assert.equal(result[0]!.baseCost, 0.3);  // median of [0.1, 0.3, 0.5]
  });
});

// ─── computeHarnessLift ─────────────────────────────────────

describe("computeHarnessLift", () => {
  test("computes median score delta between harnesses", () => {
    const entries = [
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.7 }),
      makeEntry({ agent: "codex", harness: "classic-de", normalized_score: 0.84 }),
    ];
    const result = computeHarnessLift(entries, "base-rt", "classic-de");
    assert.equal(result.length, 1);
    assert.equal(result[0]!.agent, "Codex");
    assert.equal(result[0]!.before, 0.7);
    assert.equal(result[0]!.after, 0.84);
    assert.equal(result[0]!.delta, 20);
  });

  test("negative delta when specialized is worse", () => {
    const entries = [
      makeEntry({ agent: "cursor", harness: "base-rt", normalized_score: 0.9 }),
      makeEntry({ agent: "cursor", harness: "classic-de", normalized_score: 0.72 }),
    ];
    const result = computeHarnessLift(entries, "base-rt", "classic-de");
    assert.equal(result[0]!.delta, -20);
  });

  test("zero delta when scores are identical", () => {
    const entries = [
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.8 }),
      makeEntry({ agent: "codex", harness: "classic-de", normalized_score: 0.8 }),
    ];
    const result = computeHarnessLift(entries, "base-rt", "classic-de");
    assert.equal(result[0]!.delta, 0);
  });

  test("excludes agents missing one harness", () => {
    const entries = [
      makeEntry({ agent: "codex", harness: "base-rt" }),
      makeEntry({ agent: "cursor", harness: "classic-de" }),
    ];
    assert.equal(computeHarnessLift(entries, "base-rt", "classic-de").length, 0);
  });

  test("handles multiple runs per condition (uses median)", () => {
    const entries = [
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.6 }),
      makeEntry({ agent: "codex", harness: "base-rt", normalized_score: 0.8 }),
      makeEntry({ agent: "codex", harness: "classic-de", normalized_score: 0.9 }),
      makeEntry({ agent: "codex", harness: "classic-de", normalized_score: 1.0 }),
    ];
    const result = computeHarnessLift(entries, "base-rt", "classic-de");
    assert.equal(result[0]!.before, 0.7);  // median of [0.6, 0.8]
    assert.equal(result[0]!.after, 0.95);  // median of [0.9, 1.0]
  });

  test("returns empty for empty input", () => {
    assert.equal(computeHarnessLift([], "base-rt", "classic-de").length, 0);
  });
});

// ─── computePersonaLift ─────────────────────────────────────

describe("computePersonaLift", () => {
  test("computes delta between baseline and savvy personas", () => {
    const entries = [
      makeEntry({ agent: "cursor", run_metadata: meta("baseline"), normalized_score: 0.6 }),
      makeEntry({ agent: "cursor", run_metadata: meta("savvy"), normalized_score: 0.72 }),
    ];
    const result = computePersonaLift(entries);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.agent, "Cursor");
    assert.equal(result[0]!.before, 0.6);
    assert.equal(result[0]!.after, 0.72);
    assert.equal(result[0]!.delta, 20);
  });

  test("returns empty when no savvy runs exist", () => {
    const entries = [makeEntry({ agent: "cursor", run_metadata: meta("baseline") })];
    assert.equal(computePersonaLift(entries).length, 0);
  });

  test("returns empty when no baseline runs exist", () => {
    const entries = [makeEntry({ agent: "cursor", run_metadata: meta("savvy") })];
    assert.equal(computePersonaLift(entries).length, 0);
  });

  test("returns empty when run_metadata is missing", () => {
    const entries = [makeEntry({ agent: "cursor", run_metadata: undefined })];
    assert.equal(computePersonaLift(entries).length, 0);
  });

  test("handles multiple agents with mixed persona coverage", () => {
    const entries = [
      makeEntry({ agent: "claude-code", run_metadata: meta("baseline"), normalized_score: 0.8 }),
      makeEntry({ agent: "claude-code", run_metadata: meta("savvy"), normalized_score: 0.96 }),
      makeEntry({ agent: "codex", run_metadata: meta("baseline"), normalized_score: 0.7 }),
      // codex has no savvy
    ];
    const result = computePersonaLift(entries);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.agent, "Claude-Code");
    assert.equal(result[0]!.delta, 20);
  });

  test("negative delta when savvy is worse", () => {
    const entries = [
      makeEntry({ agent: "codex", run_metadata: meta("baseline"), normalized_score: 0.9 }),
      makeEntry({ agent: "codex", run_metadata: meta("savvy"), normalized_score: 0.81 }),
    ];
    const result = computePersonaLift(entries);
    assert.equal(result[0]!.delta, -10);
  });
});

// ─── computeEfficiency ──────────────────────────────────────

describe("computeEfficiency", () => {
  test("computes median cost, tokens, time per agent", () => {
    const entries = [
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 100, agentSteps: 1, tokensUsed: 40000, llmApiCostUsd: 1.0 } }),
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 200, agentSteps: 2, tokensUsed: 60000, llmApiCostUsd: 3.0 } }),
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 150, agentSteps: 1, tokensUsed: 50000, llmApiCostUsd: 2.0 } }),
    ];
    const result = computeEfficiency(entries);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.agent, "Codex");
    assert.equal(result[0]!.medianCost, 2.0);
    assert.equal(result[0]!.medianTokens, 50000);
    assert.equal(result[0]!.medianTime, 150);
  });

  test("median of even count averages the two middle values", () => {
    const entries = [
      makeEntry({ agent: "cursor", efficiency: { wallClockSeconds: 100, agentSteps: 1, tokensUsed: 10000, llmApiCostUsd: 1.0 } }),
      makeEntry({ agent: "cursor", efficiency: { wallClockSeconds: 200, agentSteps: 1, tokensUsed: 20000, llmApiCostUsd: 3.0 } }),
    ];
    const result = computeEfficiency(entries);
    assert.equal(result[0]!.medianCost, 2.0);
    assert.equal(result[0]!.medianTokens, 15000);
    assert.equal(result[0]!.medianTime, 150);
  });

  test("single run returns exact values", () => {
    const entries = [
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 77, agentSteps: 3, tokensUsed: 12345, llmApiCostUsd: 0.42 } }),
    ];
    const result = computeEfficiency(entries);
    assert.equal(result[0]!.medianCost, 0.42);
    assert.equal(result[0]!.medianTokens, 12345);
    assert.equal(result[0]!.medianTime, 77);
  });

  test("returns empty for empty input", () => {
    assert.equal(computeEfficiency([]).length, 0);
  });

  test("handles multiple agents independently", () => {
    const entries = [
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 100, agentSteps: 1, tokensUsed: 10000, llmApiCostUsd: 1.0 } }),
      makeEntry({ agent: "cursor", efficiency: { wallClockSeconds: 200, agentSteps: 1, tokensUsed: 20000, llmApiCostUsd: 2.0 } }),
    ];
    const result = computeEfficiency(entries);
    assert.equal(result.length, 2);
    const codex = result.find((r) => r.agent === "Codex")!;
    const cursor = result.find((r) => r.agent === "Cursor")!;
    assert.equal(codex.medianCost, 1.0);
    assert.equal(cursor.medianCost, 2.0);
  });

  test("median is not affected by outlier ordering", () => {
    const entries = [
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 999, agentSteps: 1, tokensUsed: 1, llmApiCostUsd: 100 } }),
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 50, agentSteps: 1, tokensUsed: 500, llmApiCostUsd: 0.5 } }),
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 60, agentSteps: 1, tokensUsed: 600, llmApiCostUsd: 0.6 } }),
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 55, agentSteps: 1, tokensUsed: 550, llmApiCostUsd: 0.55 } }),
      makeEntry({ agent: "codex", efficiency: { wallClockSeconds: 1, agentSteps: 1, tokensUsed: 999999, llmApiCostUsd: 0.01 } }),
    ];
    const result = computeEfficiency(entries);
    assert.equal(result[0]!.medianCost, 0.55);  // sorted: [0.01, 0.5, 0.55, 0.6, 100] → middle = 0.55
    assert.equal(result[0]!.medianTokens, 550); // sorted: [1, 500, 550, 600, 999999] → middle = 550
    assert.equal(result[0]!.medianTime, 55);     // sorted: [1, 50, 55, 60, 999] → middle = 55
  });
});
