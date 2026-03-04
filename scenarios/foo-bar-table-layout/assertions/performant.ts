import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function metric_filter_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT toDate(ts) AS day, avg(value) FROM analytics.metrics_optimized WHERE metric_name = 'cpu_usage' AND ts >= '2026-01-01' GROUP BY day ORDER BY day",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Metric filter query under 200ms." : `Metric filter query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function host_filter_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT metric_name, count() FROM analytics.metrics_optimized WHERE host_id = 'host_042' GROUP BY metric_name",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Host filter query under 200ms." : `Host filter query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
