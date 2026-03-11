import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function scan_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT event_type, count() AS n, sum(value) AS total FROM analytics.events GROUP BY event_type",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Scan query under 100ms." : `Scan query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
