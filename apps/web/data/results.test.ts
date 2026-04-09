import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { EvalResult } from "./results-core";
import {
  loadResults,
  deriveLeaderboardEntries,
  deriveUniqueScenarios,
  deriveUniqueHarnesses,
  deriveUniqueModels,
  deriveUniquePersonas,
} from "./results-core";

const MINIMAL_GATES: EvalResult["gates"] = {
  functional: { passed: true, score: 1, core: {}, scenario: {} },
  correct: { passed: true, score: 1, core: {}, scenario: {} },
  robust: { passed: true, score: 1, core: {}, scenario: {} },
  performant: { passed: true, score: 0, core: {}, scenario: {} },
  production: { passed: false, score: 0, core: {}, scenario: {} },
};

const MINIMAL_EFFICIENCY: EvalResult["efficiency"] = {
  wallClockSeconds: 120,
  agentSteps: 8,
  tokensUsed: 5000,
  llmApiCostUsd: 0.5,
};

function makeFixture(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    scenario: "test-scenario",
    version: "1.0.0",
    harness: "classic-de",
    agent: "claude-code",
    model: "sonnet-4.8",
    highest_gate: 3,
    normalized_score: 0.85,
    gates: MINIMAL_GATES,
    efficiency: MINIMAL_EFFICIENCY,
    ...overrides,
  };
}

function withFixtureDir(
  fixtures: Record<string, EvalResult>,
  fn: (dir: string) => void,
) {
  const originalDir = process.env.DEC_BENCH_RESULTS_DIR;
  const fixtureRoot = mkdtempSync(join(tmpdir(), "results-test-"));
  const resultsDir = join(fixtureRoot, "results");
  mkdirSync(resultsDir, { recursive: true });

  for (const [name, data] of Object.entries(fixtures)) {
    writeFileSync(join(resultsDir, name), JSON.stringify(data, null, 2), "utf8");
  }

  process.env.DEC_BENCH_RESULTS_DIR = resultsDir;
  try {
    fn(resultsDir);
  } finally {
    if (originalDir === undefined) {
      delete process.env.DEC_BENCH_RESULTS_DIR;
    } else {
      process.env.DEC_BENCH_RESULTS_DIR = originalDir;
    }
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("loadResults returns parsed results from fixture directory", () => {
  withFixtureDir(
    {
      "test-scenario-run-001.json": makeFixture({ run_id: "run-001" }),
      "test-scenario-run-002.json": makeFixture({
        run_id: "run-002",
        model: "opus-4.8",
        highest_gate: 5,
        normalized_score: 1.0,
      }),
    },
    () => {
      const results = loadResults();
      assert.equal(results.length, 2);
      assert.ok(results.some((r) => r.run_id === "run-001"));
      assert.ok(results.some((r) => r.run_id === "run-002"));
    },
  );
});

test("loadResults returns empty array for empty directory", () => {
  withFixtureDir({}, () => {
    const results = loadResults();
    assert.equal(results.length, 0);
  });
});

test("deriveLeaderboardEntries sorts by highest_gate desc then normalized_score desc", () => {
  const results: EvalResult[] = [
    makeFixture({ scenario: "a", run_id: "r1", highest_gate: 3, normalized_score: 0.8 }),
    makeFixture({ scenario: "b", run_id: "r2", highest_gate: 5, normalized_score: 1.0 }),
    makeFixture({ scenario: "c", run_id: "r3", highest_gate: 3, normalized_score: 0.95 }),
    makeFixture({ scenario: "d", run_id: "r4", highest_gate: 1, normalized_score: 0.1 }),
  ];

  const entries = deriveLeaderboardEntries(results);
  assert.equal(entries.length, 4);
  assert.equal(entries[0]!.scenario, "b");
  assert.equal(entries[0]!.rank, 1);
  assert.equal(entries[1]!.scenario, "c");
  assert.equal(entries[1]!.rank, 2);
  assert.equal(entries[2]!.scenario, "a");
  assert.equal(entries[2]!.rank, 3);
  assert.equal(entries[3]!.scenario, "d");
  assert.equal(entries[3]!.rank, 4);
});

test("deriveUniqueScenarios returns sorted deduplicated scenario names", () => {
  const results = [
    makeFixture({ scenario: "csv-ingest" }),
    makeFixture({ scenario: "broken-connection" }),
    makeFixture({ scenario: "csv-ingest" }),
    makeFixture({ scenario: "stream-to-olap" }),
  ];

  const scenarios = deriveUniqueScenarios(results);
  assert.deepEqual(scenarios, ["broken-connection", "csv-ingest", "stream-to-olap"]);
});

test("deriveUniqueHarnesses returns sorted deduplicated harness names", () => {
  const results = [
    makeFixture({ harness: "classic-de" }),
    makeFixture({ harness: "base-rt" }),
    makeFixture({ harness: "classic-de" }),
  ];

  const harnesses = deriveUniqueHarnesses(results);
  assert.deepEqual(harnesses, ["base-rt", "classic-de"]);
});

test("deriveUniqueModels returns sorted deduplicated model names", () => {
  const results = [
    makeFixture({ model: "sonnet-4.8" }),
    makeFixture({ model: "opus-4.8" }),
    makeFixture({ model: "gpt-5.4" }),
    makeFixture({ model: "sonnet-4.8" }),
  ];

  const models = deriveUniqueModels(results);
  assert.deepEqual(models, ["gpt-5.4", "opus-4.8", "sonnet-4.8"]);
});

test("deriveUniquePersonas returns sorted personas, skipping entries without run_metadata", () => {
  const results = [
    makeFixture({
      run_metadata: { persona: "baseline", planMode: "none", promptPath: "", promptSha256: "", promptContent: "" },
    }),
    makeFixture({
      run_metadata: { persona: "naive", planMode: "none", promptPath: "", promptSha256: "", promptContent: "" },
    }),
    makeFixture({}),
    makeFixture({
      run_metadata: { persona: "baseline", planMode: "none", promptPath: "", promptSha256: "", promptContent: "" },
    }),
  ];

  const personas = deriveUniquePersonas(results);
  assert.deepEqual(personas, ["baseline", "naive"]);
});

test("deriveUniquePersonas returns empty array when no entries have persona", () => {
  const results = [makeFixture(), makeFixture()];
  const personas = deriveUniquePersonas(results);
  assert.deepEqual(personas, []);
});

test("loadResults deduplicates by scenario:run_id", () => {
  withFixtureDir(
    {
      "test-scenario-run-dup-a.json": makeFixture({
        scenario: "dup-test",
        run_id: "run-same",
        normalized_score: 0.5,
      }),
      "test-scenario-run-dup-b.json": makeFixture({
        scenario: "dup-test",
        run_id: "run-same",
        normalized_score: 0.9,
      }),
    },
    () => {
      const results = loadResults();
      assert.equal(results.length, 1);
      assert.equal(results[0]!.normalized_score, 0.5);
    },
  );
});

test("end-to-end: loadResults + derive functions work together", () => {
  withFixtureDir(
    {
      "scenario-a-run-1.json": makeFixture({
        scenario: "scenario-a",
        run_id: "run-1",
        harness: "classic-de",
        agent: "claude-code",
        model: "sonnet-4.8",
        highest_gate: 5,
        normalized_score: 1.0,
        run_metadata: { persona: "baseline", planMode: "none", promptPath: "", promptSha256: "", promptContent: "" },
      }),
      "scenario-b-run-2.json": makeFixture({
        scenario: "scenario-b",
        run_id: "run-2",
        harness: "base-rt",
        agent: "codex",
        model: "gpt-5.4",
        highest_gate: 3,
        normalized_score: 0.85,
        run_metadata: { persona: "naive", planMode: "none", promptPath: "", promptSha256: "", promptContent: "" },
      }),
      "scenario-a-run-3.json": makeFixture({
        scenario: "scenario-a",
        run_id: "run-3",
        harness: "classic-de",
        agent: "cursor",
        model: "composer",
        highest_gate: 1,
        normalized_score: 0.1,
      }),
    },
    () => {
      const results = loadResults();
      assert.equal(results.length, 3);

      const entries = deriveLeaderboardEntries(results);
      assert.equal(entries[0]!.run_id, "run-1");
      assert.equal(entries[0]!.rank, 1);

      assert.deepEqual(deriveUniqueScenarios(results), ["scenario-a", "scenario-b"]);
      assert.deepEqual(deriveUniqueHarnesses(results), ["base-rt", "classic-de"]);
      assert.deepEqual(deriveUniqueModels(results), ["composer", "gpt-5.4", "sonnet-4.8"]);
      assert.deepEqual(deriveUniquePersonas(results), ["baseline", "naive"]);
    },
  );
});
