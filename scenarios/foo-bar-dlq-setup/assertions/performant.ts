import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function dlq_table_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.dlq_events",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "DLQ query under 100ms." : `DLQ query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
