import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function date_filter_query_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.events WHERE event_ts >= '2025-06-01' AND event_ts < '2025-07-01'",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? "Date filter query under 500ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
