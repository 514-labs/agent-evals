import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function daily_aggregation_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query:
      "SELECT * FROM analytics.daily_sessions ORDER BY day DESC LIMIT 30",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Daily aggregation under 200ms." : `Daily aggregation took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
