import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AssertionContext } from "./context.js";
import { runGateEvaluation } from "./runner.js";

function fakeContext(env: Record<string, string | undefined>): AssertionContext {
  return {
    pg: { query: async () => { throw new Error("pg unused"); } },
    clickhouse: {} as AssertionContext["clickhouse"],
    env: (key: string) => env[key],
  };
}

function buildFixture(): {
  assertionsDir: string;
  metaJudgesDir: string;
  workspaceRoot: string;
  cleanup: () => void;
} {
  const tmpRoot = mkdtempSync(join(tmpdir(), "runner-meta-"));
  const assertionsDir = join(tmpRoot, "assertions");
  mkdirSync(assertionsDir);
  // Empty workspace; runner expects the dir to exist.
  const workspaceRoot = join(tmpRoot, "workspace");
  mkdirSync(workspaceRoot);

  // Minimal scenario.json so production-config loads cleanly.
  writeFileSync(
    join(tmpRoot, "scenario.json"),
    JSON.stringify({
      id: "meta-test",
      tier: "tier-1",
      infrastructure: { services: [] },
    }),
  );

  // Meta-judges tree with one judge.
  const metaJudgesDir = join(tmpRoot, "meta-judges");
  mkdirSync(metaJudgesDir);
  const judgeDir = join(metaJudgesDir, "fake-judge");
  mkdirSync(judgeDir);
  writeFileSync(
    join(judgeDir, "meta-judge.json"),
    JSON.stringify({
      id: "fake-judge",
      inputs: ["sessionLog"],
      tools: [],
      model: "claude-sonnet-4-6",
      samples: 1,
      maxTurns: 2,
      advisory: true,
    }),
  );
  writeFileSync(join(judgeDir, "rubric.md"), "# Test rubric\nNot used because no API key.");

  return {
    assertionsDir,
    metaJudgesDir,
    workspaceRoot,
    cleanup: () => rmSync(tmpRoot, { recursive: true, force: true }),
  };
}

async function runEval(options: {
  metaJudgesDir?: string;
  disableMetaJudges?: boolean;
  scenarioOptOut?: Record<string, boolean>;
}) {
  const fixture = buildFixture();
  if (options.scenarioOptOut) {
    writeFileSync(
      join(fixture.assertionsDir, "..", "scenario.json"),
      JSON.stringify({
        id: "meta-test",
        tier: "tier-1",
        infrastructure: { services: [] },
        metaJudges: options.scenarioOptOut,
      }),
    );
  }
  try {
    const result = await runGateEvaluation({
      assertionsDir: fixture.assertionsDir,
      context: fakeContext({}),
      processExitCode: 0,
      workspaceRoot: fixture.workspaceRoot,
      secretScanRoot: fixture.workspaceRoot,
      scenario: "meta-test",
      version: "v0",
      harness: "base-rt",
      agent: "claude-code",
      model: "test",
      efficiency: { wallClockSeconds: 0, agentSteps: 0, tokensUsed: 0, llmApiCostUsd: 0 },
      metaJudgesDir: options.metaJudgesDir ?? fixture.metaJudgesDir,
      disableMetaJudges: options.disableMetaJudges ?? false,
    });
    return result;
  } finally {
    fixture.cleanup();
  }
}

test("meta-judges skip cleanly without ANTHROPIC_API_KEY (non-Anthropic agents)", async () => {
  const { output, assertionLogs } = await runEval({});
  assert.ok(assertionLogs.meta, "expected meta slot");
  const fakeJudgeLog = assertionLogs.meta?.fake_judge;
  assert.ok(fakeJudgeLog, "expected fake_judge entry under meta");
  // Skipped, not failed: codex / cursor users are not penalized.
  assert.equal(fakeJudgeLog.skipped, true);
  assert.match(String(fakeJudgeLog.message), /ANTHROPIC_API_KEY not set/);
  // Meta does NOT affect gate scoring.
  assert.equal(output.normalized_score, 1);
  assert.equal(output.highest_gate, 5);
});

test("EVAL_DISABLE_META_JUDGES path leaves meta slot empty", async () => {
  const { output, assertionLogs } = await runEval({ disableMetaJudges: true });
  assert.equal(assertionLogs.meta, undefined);
  assert.equal(output.normalized_score, 1);
});

test("scenario.json metaJudges opt-out filters specific judges", async () => {
  const { assertionLogs } = await runEval({
    scenarioOptOut: { "fake-judge": false },
  });
  // Filtering removed all judges, so meta slot is left empty.
  assert.equal(assertionLogs.meta, undefined);
});

test("scenario.json metaJudges opt-in (true) keeps the judge", async () => {
  const { assertionLogs } = await runEval({
    scenarioOptOut: { "fake-judge": true },
  });
  assert.ok(assertionLogs.meta?.fake_judge);
});

test("missing metaJudgesDir is a no-op (no meta slot, no crash)", async () => {
  // Use an explicit nonexistent path so option is set but folder is missing.
  const { output, assertionLogs } = await runEval({ metaJudgesDir: "/nonexistent/meta-judges" });
  assert.equal(assertionLogs.meta, undefined);
  assert.equal(output.normalized_score, 1);
});

test("score isolation: with vs without meta-judges, gate scores are identical", async () => {
  const withMeta = await runEval({});
  const withoutMeta = await runEval({ disableMetaJudges: true });
  assert.equal(withMeta.output.highest_gate, withoutMeta.output.highest_gate);
  assert.equal(withMeta.output.normalized_score, withoutMeta.output.normalized_score);
  assert.deepEqual(withMeta.output.gates, withoutMeta.output.gates);
});

test("per-scenario judge skipped without ANTHROPIC_API_KEY does not penalize the gate", async () => {
  // Build a fixture with a per-scenario llmJudge in correct.ts. Because
  // ANTHROPIC_API_KEY is unset, the judge skips. The gate should pass as
  // if the judge were never authored, matching pre-LLM-judge behavior for
  // non-Anthropic agents (codex, cursor).
  const tmpRoot = mkdtempSync(join(tmpdir(), "judge-skip-"));
  const assertionsDir = join(tmpRoot, "assertions");
  mkdirSync(assertionsDir);
  const workspaceRoot = join(tmpRoot, "workspace");
  mkdirSync(workspaceRoot);
  writeFileSync(
    join(tmpRoot, "scenario.json"),
    JSON.stringify({ id: "skip-test", tier: "tier-1", infrastructure: { services: [] } }),
  );
  writeFileSync(
    join(assertionsDir, "correct.ts"),
    `import { llmJudge } from "@dec-bench/eval-core";
export const judged_quality = llmJudge({
  rubric: "always pass",
  inputs: [],
});
`,
  );

  try {
    const result = await runGateEvaluation({
      assertionsDir,
      context: fakeContext({}),
      processExitCode: 0,
      workspaceRoot,
      secretScanRoot: workspaceRoot,
      scenario: "skip-test",
      version: "v0",
      harness: "base-rt",
      agent: "codex",
      model: "test",
      efficiency: { wallClockSeconds: 0, agentSteps: 0, tokensUsed: 0, llmApiCostUsd: 0 },
      disableMetaJudges: true,
    });

    const correctGate = result.output.gates.correct;
    assert.equal(correctGate.passed, true, "gate must pass when only assertion is a skipped judge");
    // Skipped result must NOT appear in the boolean results map.
    assert.ok(
      !("judged_quality" in correctGate.scenario),
      `judged_quality should be excluded from scenario results, got: ${JSON.stringify(correctGate.scenario)}`,
    );
    // But it MUST appear in the assertion log with skipped: true.
    const log = result.assertionLogs.correct.scenario.judged_quality;
    assert.ok(log, "judged_quality log entry expected");
    assert.equal(log.skipped, true);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
