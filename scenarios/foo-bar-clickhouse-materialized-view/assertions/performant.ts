import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function daily_summary_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.daily_event_summary ORDER BY day, event_type",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Daily summary query under 200ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
