import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function api_response_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/metrics");
  await res.text();
  const elapsed = Date.now() - start;
  const passed = res.ok && elapsed < 500;
  return {
    passed,
    message: passed ? "API response under 500ms." : `Response took ${elapsed}ms, status ${res.status}.`,
    details: { elapsedMs: elapsed, status: res.status },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
