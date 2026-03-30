import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function point_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.orders FINAL WHERE order_id = 'ord_050'",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Point query under 100ms." : `Point query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
