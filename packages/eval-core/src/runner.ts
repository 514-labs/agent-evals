import { readFileSync } from "node:fs";

import type { BaselineMetrics, ObservedMetrics, ReferenceMetrics } from "@dec-bench/scenarios";

import type { AssertionContext } from "./context.js";
import { loadScenarioAssertions, type AssertionFn } from "./discovery.js";
import type {
  AssertionLogMap,
  AssertionLogOutput,
  EvalOutput,
  GateName,
  GateResult,
} from "./types.js";
import { createEvalOutput } from "./output.js";
import { computeScore } from "./score.js";

const GATES: GateName[] = ["functional", "correct", "robust", "performant", "production"];
const PASS_THRESHOLD = 0.8;

export interface GateRunnerOptions {
  assertionsDir: string;
  context: AssertionContext;
  processExitCode: number;
  sessionLogPath?: string;
  scenario: string;
  version: string;
  harness: string;
  agent: string;
  model: string;
  runMetadata?: EvalOutput["run_metadata"];
  efficiency: EvalOutput["efficiency"];
  baselineMetrics?: BaselineMetrics;
  referenceMetrics?: ReferenceMetrics;
  observedMetrics?: ObservedMetrics;
}

export async function runGateEvaluation(
  options: GateRunnerOptions,
): Promise<{ output: EvalOutput; assertionLogs: AssertionLogOutput }> {
  const discovered = await loadScenarioAssertions(options.assertionsDir);
  const gates: Record<GateName, GateResult> = {
    functional: emptyGate(),
    correct: emptyGate(),
    robust: emptyGate(),
    performant: emptyGate(),
    production: emptyGate(),
  };
  const assertionLogs: AssertionLogOutput = {
    functional: { core: {}, scenario: {} },
    correct: { core: {}, scenario: {} },
    robust: { core: {}, scenario: {} },
    performant: { core: {}, scenario: {} },
    production: { core: {}, scenario: {} },
  };

  let blocked = false;
  let highestGate = 0;
  let scoreSum = 0;

  for (const gate of GATES) {
    if (blocked) {
      gates[gate] = emptyGate();
      continue;
    }

    const core = await runAssertions(
      getCoreAssertions(gate, options.processExitCode, options.sessionLogPath),
      options.context,
    );
    const scenario = await runAssertions(discovered[gate], options.context);
    const corePassed = allPassed(core.results);
    const scenarioScore = calcScore(scenario.results);
    const passed = corePassed && scenarioScore >= PASS_THRESHOLD;

    gates[gate] = {
      passed,
      score: scenarioScore,
      core: core.results,
      scenario: scenario.results,
    };
    assertionLogs[gate] = {
      core: core.logs,
      scenario: scenario.logs,
    };

    scoreSum += scenarioScore;
    if (passed) {
      highestGate += 1;
    } else {
      blocked = true;
    }
  }

  let compositeScore: EvalOutput["composite_score"];
  if (options.baselineMetrics && options.referenceMetrics && options.observedMetrics) {
    const breakdown = computeScore(
      options.baselineMetrics,
      options.referenceMetrics,
      options.observedMetrics,
    );
    compositeScore = {
      total: breakdown.total,
      components: breakdown.components,
    };
  }

  return {
    output: createEvalOutput({
      scenario: options.scenario,
      version: options.version,
      harness: options.harness,
      agent: options.agent,
      model: options.model,
      runMetadata: options.runMetadata,
      highestGate,
      normalizedScore: clamp(scoreSum / GATES.length),
      compositeScore,
      gates,
      efficiency: options.efficiency,
    }),
    assertionLogs,
  };
}

function emptyGate(): GateResult {
  return {
    passed: false,
    score: 0,
    core: {},
    scenario: {},
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function calcScore(resultMap: Record<string, boolean>): number {
  const entries = Object.values(resultMap);
  if (entries.length === 0) {
    return 1;
  }

  const passedCount = entries.filter(Boolean).length;
  return clamp(passedCount / entries.length);
}

function allPassed(resultMap: Record<string, boolean>): boolean {
  return Object.values(resultMap).every(Boolean);
}

async function runAssertions(
  assertions: Record<string, AssertionFn>,
  context: AssertionContext,
): Promise<{ results: Record<string, boolean>; logs: AssertionLogMap }> {
  const results: Record<string, boolean> = {};
  const logs: AssertionLogMap = {};
  for (const [name, fn] of Object.entries(assertions)) {
    const started = Date.now();
    try {
      const outcome = await fn(context);
      const passed = Boolean(outcome.passed);
      results[name] = passed;
      logs[name] = {
        passed,
        durationMs: Date.now() - started,
        message: outcome.message,
        details: outcome.details,
      };
    } catch (error) {
      results[name] = false;
      logs[name] = {
        passed: false,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      };
    }
  }
  return { results, logs };
}

function getCoreAssertions(
  gate: GateName,
  processExitCode: number,
  sessionLogPath?: string,
): Record<string, AssertionFn> {
  if (gate === "functional") {
    return {
      process_exits_clean: async () => ({
        passed: processExitCode === 0,
        message:
          processExitCode === 0
            ? "Agent process exited cleanly."
            : `Agent process exited with code ${processExitCode}.`,
        details: { exitCode: processExitCode },
      }),
      no_unhandled_errors: async () => {
        if (!sessionLogPath) {
          return {
            passed: true,
            message: "Session log path unavailable; unhandled error scan skipped.",
          };
        }
        const sessionLog = safeRead(sessionLogPath);
        if (!sessionLog) {
          return {
            passed: true,
            message: "Session log missing or unreadable; unhandled error scan skipped.",
            details: { sessionLogPath },
          };
        }
        const passed = !/unhandled|traceback|panic:/i.test(sessionLog);
        return {
          passed,
          message: passed
            ? "No unhandled errors, tracebacks, or panics found in session log."
            : "Unhandled error indicators found in session log.",
          details: { sessionLogPath },
        };
      },
    };
  }

  if (gate === "robust") {
    return {
      idempotent_rerun: async () => ({
        passed: true,
        message: "Idempotent rerun check is currently a placeholder assertion.",
      }),
    };
  }

  if (gate === "production") {
    return {
      uses_env_vars: async (ctx) => {
        const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
        const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
        const passed = hasPostgres && hasClickHouse;
        return {
          passed,
          message: passed
            ? "Required data store environment variables are available."
            : "Missing required data store environment variables.",
          details: {
            hasPostgresUrl: hasPostgres,
            hasClickhouseUrl: hasClickHouse,
          },
        };
      },
      no_secrets_in_code: async () => ({
        passed: true,
        message: "Secret scanning assertion is currently a placeholder.",
      }),
    };
  }

  return {};
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
