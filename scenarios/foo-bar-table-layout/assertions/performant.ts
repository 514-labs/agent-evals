import type { AssertionContext } from "@dec-bench/eval-core";

export async function metric_filter_query_under_200ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT toDate(ts) AS day, avg(value) FROM analytics.metrics_optimized WHERE metric_name = 'cpu_usage' AND ts >= '2026-01-01' GROUP BY day ORDER BY day",
    format: "JSONEachRow",
  });
  return Date.now() - start < 200;
}

export async function host_filter_query_under_200ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT metric_name, count() FROM analytics.metrics_optimized WHERE host_id = 'host_042' GROUP BY metric_name",
    format: "JSONEachRow",
  });
  return Date.now() - start < 200;
}
