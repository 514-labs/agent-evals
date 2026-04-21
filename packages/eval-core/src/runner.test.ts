import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { AssertionContext } from "./context.js";
import { runGateEvaluation } from "./runner.js";

function createTestContext(env: Record<string, string | undefined>): AssertionContext {
  return {
    pg: {
      query: async () => {
        throw new Error("pg should not be used in runner tests");
      },
    },
    clickhouse: {} as AssertionContext["clickhouse"],
    env: (key: string) => env[key],
  };
}

function createFixtureDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function createScenarioJson(options?: {
  services?: string[];
  productionChecks?: { maxExpectedLines?: number; maxFileLines?: number };
  tier?: string;
}) {
  return JSON.stringify({
    id: "test-scenario",
    title: "Test Scenario",
    description: "Test.",
    tier: options?.tier ?? "tier-1",
    domain: "foo-bar",
    harness: "base-rt",
    tasks: [{ id: "task-1", description: "Do the thing", category: "ingestion" }],
    infrastructure: {
      services: options?.services ?? [],
      description: "Test infrastructure.",
    },
    tags: ["test"],
    baselineMetrics: { queryLatencyMs: 0, storageBytes: 0, costPerQueryUsd: 0 },
    referenceMetrics: { queryLatencyMs: 1, storageBytes: 1, costPerQueryUsd: 1 },
    productionChecks: options?.productionChecks,
  });
}

async function runCoreEvaluation(options: {
  workspaceRoot: string;
  sessionLogPath?: string;
  idempotentRerunCommand?: string;
  processExitCode?: number;
  env?: Record<string, string | undefined>;
  assertionFiles?: Partial<Record<"functional" | "correct" | "robust" | "performant" | "production", string>>;
  scenarioJson?: string;
}) {
  const assertionsDir = createFixtureDir("eval-core-assertions-");
  for (const [gate, source] of Object.entries(options.assertionFiles ?? {})) {
    writeFileSync(join(assertionsDir, `${gate}.ts`), source, "utf8");
  }
  if (options.scenarioJson) {
    writeFileSync(join(assertionsDir, "..", "scenario.json"), options.scenarioJson, "utf8");
  }

  try {
    return await runGateEvaluation({
      assertionsDir,
      context: createTestContext({
        POSTGRES_URL: "postgresql://postgres@localhost:5432/postgres",
        CLICKHOUSE_URL: "http://localhost:8123",
        ...options.env,
      }),
      processExitCode: options.processExitCode ?? 0,
      sessionLogPath: options.sessionLogPath,
      workspaceRoot: options.workspaceRoot,
      secretScanRoot: options.workspaceRoot,
      idempotentRerunCommand: options.idempotentRerunCommand,
      scenario: "test-scenario",
      version: "v0.1.0",
      harness: "base-rt",
      agent: "claude-code",
      model: "test-model",
      efficiency: {
        wallClockSeconds: 0,
        agentSteps: 0,
        tokensUsed: 0,
        llmApiCostUsd: 0,
      },
    });
  } finally {
    rmSync(assertionsDir, { recursive: true, force: true });
  }
}

const TWO_PASSING_ASSERTIONS = `
export async function first_assertion() {
  return { passed: true };
}

export async function second_assertion() {
  return { passed: true };
}
`;

const TWO_OF_THREE_PASSING_ASSERTIONS = `
export async function first_assertion() {
  return { passed: true };
}

export async function second_assertion() {
  return { passed: true };
}

export async function third_assertion() {
  return { passed: false };
}
`;

test("configured idempotent rerun passes when the workspace stabilizes", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    idempotentRerunCommand: "printf 'ready\\n' > state.txt",
  });
  const rerunLog = assertionLogs.robust.core.idempotent_rerun;

  assert.equal(output.gates.robust.core.idempotent_rerun, true);
  assert.equal(output.gates.robust.passed, true);
  assert.ok(rerunLog);
  assert.match(rerunLog.message ?? "", /same workspace state on consecutive runs/i);
});

test("configured idempotent rerun fails when the second run mutates the workspace", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    idempotentRerunCommand: "printf 'tick\\n' >> state.txt",
  });
  const rerunLog = assertionLogs.robust.core.idempotent_rerun;

  assert.equal(output.gates.robust.core.idempotent_rerun, false);
  assert.ok(rerunLog);
  assert.match(rerunLog.message ?? "", /changed the workspace on the second run/i);
});

test("session-log fallback flags duplicate-key idempotency failures", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  const sessionRoot = createFixtureDir("eval-core-session-");
  const sessionLogPath = join(sessionRoot, "session.log");
  writeFileSync(
    sessionLogPath,
    "duplicate key value violates unique constraint \"orders_pkey\"\n",
    "utf8",
  );

  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));
  t.after(() => rmSync(sessionRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    sessionLogPath,
  });
  const rerunLog = assertionLogs.robust.core.idempotent_rerun;

  assert.equal(output.gates.robust.core.idempotent_rerun, false);
  assert.ok(rerunLog);
  assert.match(rerunLog.message ?? "", /risk markers/i);
});

test("production env assertion passes when the scenario declares no services", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    env: {
      POSTGRES_URL: undefined,
      CLICKHOUSE_URL: undefined,
      REDPANDA_BROKER: undefined,
    },
    scenarioJson: createScenarioJson({ services: [] }),
  });
  const envLog = assertionLogs.production.core.uses_env_vars;

  assert.equal(output.gates.production.core.uses_env_vars, true);
  assert.ok(envLog);
  assert.match(
    envLog.message ?? "",
    /no data store environment variables are required/i,
  );
});

test("production env assertion only requires ClickHouse for clickhouse-only scenarios", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    env: {
      POSTGRES_URL: undefined,
    },
    scenarioJson: createScenarioJson({ services: ["clickhouse"] }),
  });
  const envLog = assertionLogs.production.core.uses_env_vars;

  assert.equal(output.gates.production.core.uses_env_vars, true);
  assert.ok(envLog);
  assert.deepEqual(envLog.details?.missingEnvVars, []);
});

test("production env assertion only requires Postgres for postgres-only scenarios", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    env: {
      CLICKHOUSE_URL: undefined,
    },
    scenarioJson: createScenarioJson({ services: ["postgres-16"] }),
  });
  const envLog = assertionLogs.production.core.uses_env_vars;

  assert.equal(output.gates.production.core.uses_env_vars, true);
  assert.ok(envLog);
  assert.deepEqual(envLog.details?.requiredEnvVars, [
    "POSTGRES_URL",
  ]);
});

test("production env assertion requires every declared service env var", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    env: {
      REDPANDA_BROKER: undefined,
    },
    scenarioJson: createScenarioJson({ services: ["postgres-16", "clickhouse", "redpanda"] }),
  });
  const envLog = assertionLogs.production.core.uses_env_vars;

  assert.equal(output.gates.production.core.uses_env_vars, false);
  assert.ok(envLog);
  assert.deepEqual(envLog.details?.missingEnvVars, [
    "REDPANDA_BROKER",
  ]);
});

test("normalized score uses total assertions in the failed gate band", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
    env: {
      CLICKHOUSE_URL: undefined,
    },
    scenarioJson: createScenarioJson({ services: ["postgres-16", "clickhouse"] }),
    assertionFiles: {
      production: TWO_PASSING_ASSERTIONS,
    },
  });

  assert.equal(output.highest_gate, 4);
  assert.equal(output.gates.production.passed, false);
  assert.equal(output.gates.production.score, 1);
  assert.equal(output.gates.production.core.uses_env_vars, false);
  assert.equal(output.gates.production.core.no_secrets_in_code, true);
  assert.equal(output.gates.production.core.output_line_count_reasonable, true);
  assert.equal(output.gates.production.core.output_line_count_disciplined, true);
  assert.equal(output.gates.production.core.no_dead_code_markers, true);
  assert.equal(output.gates.production.core.files_are_reasonably_sized, true);
  assert.equal(output.gates.production.core.no_debug_artifacts, true);
  assert.equal(output.gates.production.core.zero_compiler_errors, true);
  assert.equal(output.gates.production.core.zero_lint_errors, true);
  assert.equal(output.gates.production.core.has_type_safety, true);
  assert.equal(output.gates.production.core.functions_are_focused, true);
  assert.equal(output.gates.production.core.no_deep_nesting, true);
  assert.equal(output.normalized_score, (4 + 13 / 14) / 5);
});

test("normalized score counts failed functional core assertions in the first band", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
    processExitCode: 1,
    assertionFiles: {
      functional: TWO_PASSING_ASSERTIONS,
    },
  });

  assert.equal(output.highest_gate, 0);
  assert.equal(output.gates.functional.passed, false);
  assert.equal(output.gates.functional.score, 1);
  assert.equal(output.gates.functional.core.process_exits_clean, false);
  assert.equal(output.gates.functional.core.no_unhandled_errors, true);
  assert.equal(output.normalized_score, 0.15);
});

test("normalized score uses assertion counts for scenario-threshold failures", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
    assertionFiles: {
      correct: TWO_OF_THREE_PASSING_ASSERTIONS,
    },
  });

  assert.equal(output.highest_gate, 1);
  assert.equal(output.gates.correct.passed, false);
  assert.equal(output.gates.correct.score, 2 / 3);
  assert.equal(output.normalized_score, 1 / 3);
});

test("secret scan flags hardcoded credentials in workspace files", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  const sourcePath = join(workspaceRoot, "app.py");
  writeFileSync(
    sourcePath,
    'OPENAI_API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"\n',
    "utf8",
  );

  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
  });
  const secretLog = assertionLogs.production.core.no_secrets_in_code;

  assert.equal(output.gates.production.core.no_secrets_in_code, false);
  assert.ok(secretLog);
  assert.match(secretLog.message ?? "", /potential/i);
});

test("secret scan ignores environment-based secret usage", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  mkdirSync(join(workspaceRoot, "src"), { recursive: true });
  writeFileSync(
    join(workspaceRoot, "src", "config.py"),
    [
      'OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]',
      'DB_PASSWORD = os.getenv("DB_PASSWORD")',
      "",
    ].join("\n"),
    "utf8",
  );

  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
  });
  const secretLog = assertionLogs.production.core.no_secrets_in_code;

  assert.equal(output.gates.production.core.no_secrets_in_code, true);
  assert.ok(secretLog);
  assert.match(secretLog.message ?? "", /no hardcoded secrets/i);
});

test("production line-count assertion honors scenario overrides", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  writeFileSync(join(workspaceRoot, "main.py"), new Array(32).fill("print('ok')").join("\n"), "utf8");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output, assertionLogs } = await runCoreEvaluation({
    workspaceRoot,
    scenarioJson: createScenarioJson({
      productionChecks: { maxExpectedLines: 20 },
    }),
  });
  const outputLineLog = assertionLogs.production.core.output_line_count_disciplined;

  assert.equal(output.gates.production.core.output_line_count_reasonable, false);
  assert.equal(output.gates.production.core.output_line_count_disciplined, false);
  assert.ok(outputLineLog);
  assert.match(
    outputLineLog.message ?? "",
    /target 20-line budget/i,
  );
});

test("production file-size assertion flags oversized files", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  writeFileSync(join(workspaceRoot, "app.ts"), new Array(16).fill("const value = 1;").join("\n"), "utf8");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
    scenarioJson: createScenarioJson({
      productionChecks: { maxFileLines: 10 },
    }),
  });

  assert.equal(output.gates.production.core.files_are_reasonably_sized, false);
});

test("production dead-code marker assertion flags TODO markers", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  writeFileSync(join(workspaceRoot, "worker.py"), "# TODO: remove scaffold\nprint('ready')\n", "utf8");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
  });

  assert.equal(output.gates.production.core.no_dead_code_markers, false);
});

test("production debug-artifact assertion flags console logs", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  writeFileSync(join(workspaceRoot, "worker.ts"), "console.log('debug');\n", "utf8");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
  });

  assert.equal(output.gates.production.core.no_debug_artifacts, false);
});

test("production type-safety assertion flags explicit any usage", async (t) => {
  const workspaceRoot = createFixtureDir("eval-core-workspace-");
  writeFileSync(join(workspaceRoot, "main.ts"), "const unsafeValue: any = {};\n", "utf8");
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const { output } = await runCoreEvaluation({
    workspaceRoot,
  });

  assert.equal(output.gates.production.core.has_type_safety, false);
});
