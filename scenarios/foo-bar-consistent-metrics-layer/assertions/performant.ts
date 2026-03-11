import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function daily_metrics_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.daily_metrics ORDER BY day",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Daily metrics query under 100ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
