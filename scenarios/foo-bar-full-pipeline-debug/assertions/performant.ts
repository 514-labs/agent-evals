import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function events_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT event_type, count() AS n FROM analytics.events GROUP BY event_type",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Events query under 200ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
