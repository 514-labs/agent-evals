import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function reconciliation_query_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query("SELECT count(*) FROM app.transactions");
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.transactions",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? "Reconciliation queries under 500ms." : `Queries took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
