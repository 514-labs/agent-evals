import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { fetchWithWarmupRetry } from "../../_shared/assertion-helpers";
import { tryResolveEndpoints } from "./shared";

const RESPONSE_TIME_BUDGET_MS = 2_000;

export async function query_endpoint_responds_under_budget(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const endpoints = tryResolveEndpoints();
  if (!endpoints) return { passed: false, message: "No deployed URL recorded.", details: {} };
  const queryUrl = endpoints.queryUrl;

  let result;
  try {
    result = await fetchWithWarmupRetry(queryUrl, undefined);
  } catch (err) {
    return {
      passed: false,
      message: `${queryUrl} unreachable: ${(err as Error).message}`,
      details: { queryUrl, error: (err as Error).message },
    };
  }

  const { status, attempts, lastAttemptElapsedMs } = result;
  const passed = status === 200 && lastAttemptElapsedMs <= RESPONSE_TIME_BUDGET_MS;
  return {
    passed,
    message: passed
      ? `${queryUrl} responded in ${lastAttemptElapsedMs}ms (budget ${RESPONSE_TIME_BUDGET_MS}ms) after ${attempts} attempt(s).`
      : status !== 200
        ? `${queryUrl} returned ${status} after ${attempts} attempt(s) — not serving the read path.`
        : `${queryUrl} took ${lastAttemptElapsedMs}ms — exceeds ${RESPONSE_TIME_BUDGET_MS}ms budget.`,
    details: { elapsedMs: lastAttemptElapsedMs, status, attempts, queryUrl },
  };
}
