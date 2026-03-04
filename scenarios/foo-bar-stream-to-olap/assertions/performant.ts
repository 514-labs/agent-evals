import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function aggregation_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT host_id, metric_name, avg(value) AS avg_val FROM analytics.metrics GROUP BY host_id, metric_name",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Aggregation under 200ms." : `Aggregation took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
