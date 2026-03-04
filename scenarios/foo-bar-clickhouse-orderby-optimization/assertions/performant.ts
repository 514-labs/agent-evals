import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function region_filter_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT sum(amount) FROM analytics.events WHERE region = 'us-west' AND event_ts >= '2026-01-01'",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Region filter query under 100ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
