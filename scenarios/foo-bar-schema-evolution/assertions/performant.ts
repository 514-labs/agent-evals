import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function select_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT id, name, price, category, weight_kg FROM analytics.products ORDER BY id",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Select query under 100ms." : `Select query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
