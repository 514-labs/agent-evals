import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function region_filter_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  // Dynamically pick a region from the data instead of hardcoding
  const regionRows = await ctx.clickhouse.query({
    query: "SELECT region FROM analytics.events LIMIT 1",
    format: "JSONEachRow",
  });
  const regions = (await (regionRows as any).json()) as { region: string }[];
  const region = regions[0]?.region ?? "us-west";

  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT sum(amount) FROM analytics.events WHERE region = '${region}' AND event_ts >= '2026-01-01'`,
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? `Region filter query under 100ms (region=${region}).` : `Query took ${elapsed}ms (region=${region}).`,
    details: { elapsedMs: elapsed, region },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
