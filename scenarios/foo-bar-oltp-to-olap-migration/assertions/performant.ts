import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function sales_aggregation_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT product_id, sum(amount) AS total FROM analytics.sales GROUP BY product_id",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Sales aggregation under 100ms." : `Aggregation took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
