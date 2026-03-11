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

async function runCoreEvaluation(options: {
  workspaceRoot: string;
  sessionLogPath?: string;
  idempotentRerunCommand?: string;
}) {
  const assertionsDir = createFixtureDir("eval-core-assertions-");

  try {
    return await runGateEvaluation({
      assertionsDir,
      context: createTestContext({
        POSTGRES_URL: "postgresql://postgres@localhost:5432/postgres",
        CLICKHOUSE_URL: "http://localhost:8123",
      }),
      processExitCode: 0,
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
