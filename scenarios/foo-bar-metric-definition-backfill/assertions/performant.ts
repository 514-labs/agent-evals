import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function metric_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.metric_daily ORDER BY day",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Metric query under 200ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
