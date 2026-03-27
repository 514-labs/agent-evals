import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function raw_events_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const start = Date.now();
    await ctx.clickhouse.query({
      query: "SELECT count() FROM analytics.raw_events",
      format: "JSONEachRow",
    });
    const elapsed = Date.now() - start;
    const passed = elapsed < 100;
    return {
      passed,
      message: passed ? "Raw events query under 100ms." : `Query took ${elapsed}ms.`,
      details: { elapsedMs: elapsed },
    };
  } catch (e) {
    return {
      passed: false,
      message: "Raw events table may not exist.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
