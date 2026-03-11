import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function metrics_daily_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.metrics_daily LIMIT 10",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Metrics daily query under 100ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
