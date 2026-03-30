import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readEntrypointSource, runReconciliationCommand } from "./shared";

export async function reconciliation_command_completes_under_3000ms(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const startedAt = Date.now();
  const run = runReconciliationCommand({ timeoutMs: 3000 });
  const elapsedMs = Date.now() - startedAt;

  if ("error" in run) {
    return {
      passed: false,
      message: run.error,
      details: { elapsedMs },
    };
  }

  const passed = !run.timedOut && elapsedMs < 3000 && (run.status === 0 || run.status === 2);
  return {
    passed,
    message: passed
      ? "Reconciliation command completes within the 3s budget."
      : `Reconciliation command exceeded the 3s budget or returned an unexpected status (${run.status}).`,
    details: {
      elapsedMs,
      status: run.status,
      timedOut: run.timedOut,
      entrypoint: run.path,
    },
  };
}

export async function reconciliation_avoids_broad_selects(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const source = readEntrypointSource();
  if (!source) {
    return {
      passed: false,
      message: "Expected a reusable reconciliation entrypoint under /workspace/scripts or /workspace/bin.",
    };
  }

  const hasBroadSelect = /\bselect\s+\*/i.test(source.content);
  return {
    passed: !hasBroadSelect,
    message: hasBroadSelect
      ? "Reconciliation entrypoint uses `SELECT *`, which is too broad for a production-facing drift probe."
      : "Reconciliation entrypoint avoids `SELECT *` style broad queries.",
    details: { entrypoint: source.path },
  };
}

export async function broker_probe_has_explicit_timeout(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const source = readEntrypointSource();
  if (!source) {
    return {
      passed: false,
      message: "Expected a reusable reconciliation entrypoint under /workspace/scripts or /workspace/bin.",
    };
  }

  const hasTimeout =
    source.content.includes("consumer_timeout_ms") ||
    source.content.includes("timeout=") ||
    source.content.includes("settimeout(");
  return {
    passed: hasTimeout,
    message: hasTimeout
      ? "Reconciliation entrypoint uses an explicit timeout for broker or dependency probes."
      : "Reconciliation entrypoint is missing an explicit timeout for broker or dependency probes.",
    details: { entrypoint: source.path },
  };
}
