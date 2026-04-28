import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { tryResolveEndpoints } from "./shared";

const RESPONSE_TIME_BUDGET_MS = 2_000;

export async function query_endpoint_responds_under_budget(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const endpoints = tryResolveEndpoints();
  if (!endpoints) return { passed: false, message: "No deployed URL recorded.", details: {} };
  const queryUrl = endpoints.queryUrl;
  const started = Date.now();
  try {
    const res = await fetch(queryUrl);
    const elapsedMs = Date.now() - started;
    const passed = res.status === 200 && elapsedMs <= RESPONSE_TIME_BUDGET_MS;
    return {
      passed,
      message: passed
        ? `${queryUrl} responded in ${elapsedMs}ms (budget ${RESPONSE_TIME_BUDGET_MS}ms).`
        : res.status !== 200
          ? `${queryUrl} returned ${res.status} after ${elapsedMs}ms — not serving the read path.`
          : `${queryUrl} took ${elapsedMs}ms — exceeds ${RESPONSE_TIME_BUDGET_MS}ms budget.`,
      details: { elapsedMs, status: res.status, queryUrl },
    };
  } catch (err) {
    return {
      passed: false,
      message: `${queryUrl} unreachable: ${(err as Error).message}.`,
      details: { queryUrl, error: (err as Error).message },
    };
  }
}
