import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function orders_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.orders",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Orders query under 100ms." : `Orders query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
