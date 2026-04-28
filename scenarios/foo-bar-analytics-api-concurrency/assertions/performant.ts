import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function api_response_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  const result = await probeEgress(ctx, "metrics", { paths: ["/api/metrics"], timeoutMs: 3000 });
  if (!result) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  await result.response.text();
  const elapsed = Date.now() - start;
  const passed = result.response.ok && elapsed < 500;
  return {
    passed,
    message: passed ? "API response under 500ms." : `Response took ${elapsed}ms, status ${result.response.status}.`,
    details: { url: result.url, elapsedMs: elapsed, status: result.response.status },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
