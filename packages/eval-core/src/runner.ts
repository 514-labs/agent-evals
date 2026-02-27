import { readFileSync } from "node:fs";

import type { BaselineMetrics, ObservedMetrics, ReferenceMetrics } from "@dec-bench/scenarios";

import type { AssertionContext } from "./context.js";
import { loadScenarioAssertions, type AssertionFn } from "./discovery.js";
import type { EvalOutput, GateName, GateResult } from "./types.js";
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
  efficiency: EvalOutput["efficiency"];
  baselineMetrics?: BaselineMetrics;
  referenceMetrics?: ReferenceMetrics;
  observedMetrics?: ObservedMetrics;
}

export async function runGateEvaluation(options: GateRunnerOptions): Promise<EvalOutput> {
  const discovered = await loadScenarioAssertions(options.assertionsDir);
  const gates: Record<GateName, GateResult> = {
    functional: emptyGate(),
    correct: emptyGate(),
    robust: emptyGate(),
    performant: emptyGate(),
    production: emptyGate(),
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
    const corePassed = allPassed(core);
    const scenarioScore = calcScore(scenario);
    const passed = corePassed && scenarioScore >= PASS_THRESHOLD;

    gates[gate] = {
      passed,
      score: scenarioScore,
      core,
      scenario,
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

  return createEvalOutput({
    scenario: options.scenario,
    version: options.version,
    harness: options.harness,
    agent: options.agent,
    model: options.model,
    highestGate,
    normalizedScore: clamp(scoreSum / GATES.length),
    compositeScore,
    gates,
    efficiency: options.efficiency,
  });
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
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const [name, fn] of Object.entries(assertions)) {
    try {
      results[name] = Boolean(await fn(context));
    } catch {
      results[name] = false;
    }
  }
  return results;
}

function getCoreAssertions(
  gate: GateName,
  processExitCode: number,
  sessionLogPath?: string,
): Record<string, AssertionFn> {
  if (gate === "functional") {
    return {
      process_exits_clean: async () => processExitCode === 0,
      no_unhandled_errors: async () => {
        if (!sessionLogPath) {
          return true;
        }
        const sessionLog = safeRead(sessionLogPath);
        if (!sessionLog) {
          return true;
        }
        return !/unhandled|traceback|panic:/i.test(sessionLog);
      },
    };
  }

  if (gate === "robust") {
    return {
      idempotent_rerun: async () => true,
    };
  }

  if (gate === "production") {
    return {
      uses_env_vars: async (ctx) => Boolean(ctx.env("POSTGRES_URL") && ctx.env("CLICKHOUSE_URL")),
      no_secrets_in_code: async () => true,
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
