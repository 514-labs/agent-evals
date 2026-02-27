import type { BaselineMetrics, ObservedMetrics, ReferenceMetrics } from "@dec-bench/scenarios";

import { createAssertionContext } from "./context.js";
import { runGateEvaluation } from "./runner.js";

function parseNumber(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonEnv<T>(envKey: string): T | undefined {
  const raw = process.env[envKey];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const assertionsDir = process.argv[2];
  if (!assertionsDir) {
    throw new Error("Usage: node cli.js <assertions-dir>");
  }

  const processExitCode = parseNumber(process.env.AGENT_EXIT_CODE, 0);
  const wallClockSeconds = parseNumber(process.env.EVAL_WALL_CLOCK_SECONDS, 0);
  const agentSteps = parseNumber(process.env.EVAL_AGENT_STEPS, 0);
  const tokensUsed = parseNumber(process.env.EVAL_TOKENS_USED, 0);
  const llmApiCostUsd = parseNumber(process.env.EVAL_LLM_API_COST_USD, 0);

  const baselineMetrics = parseJsonEnv<BaselineMetrics>("EVAL_BASELINE_METRICS");
  const referenceMetrics = parseJsonEnv<ReferenceMetrics>("EVAL_REFERENCE_METRICS");

  const observedMetrics: ObservedMetrics | undefined =
    process.env.EVAL_OBSERVED_QUERY_LATENCY_MS
      ? {
          queryLatencyMs: parseNumber(process.env.EVAL_OBSERVED_QUERY_LATENCY_MS, 0),
          storageBytes: parseNumber(process.env.EVAL_OBSERVED_STORAGE_BYTES, 0),
          costPerQueryUsd: parseNumber(process.env.EVAL_OBSERVED_COST_PER_QUERY_USD, 0),
          tasksCompleted: parseNumber(process.env.EVAL_OBSERVED_TASKS_COMPLETED, 0),
          totalTasks: parseNumber(process.env.EVAL_OBSERVED_TOTAL_TASKS, 1),
        }
      : undefined;

  const handle = createAssertionContext(process.env);
  try {
    const output = await runGateEvaluation({
      assertionsDir,
      context: handle.context,
      processExitCode,
      sessionLogPath: process.env.EVAL_SESSION_LOG_PATH,
      scenario: process.env.EVAL_SCENARIO ?? "unknown",
      version: process.env.EVAL_VERSION ?? "0.0.0",
      harness: process.env.EVAL_HARNESS ?? "bare",
      agent: process.env.EVAL_AGENT ?? "claude-code",
      model: process.env.MODEL ?? "unknown",
      efficiency: {
        wallClockSeconds,
        agentSteps,
        tokensUsed,
        llmApiCostUsd,
      },
      baselineMetrics,
      referenceMetrics,
      observedMetrics,
    });
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`eval-core cli failed: ${message}\n`);
  process.exit(1);
});
