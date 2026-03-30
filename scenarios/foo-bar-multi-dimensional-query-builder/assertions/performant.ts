import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function metrics_query_under_300ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/metrics");
  await res.text();
  const elapsed = Date.now() - start;
  const passed = res.ok && elapsed < 300;
  return {
    passed,
    message: passed ? "Metrics query under 300ms." : `Response took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
