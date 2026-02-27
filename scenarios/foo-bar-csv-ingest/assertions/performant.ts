import type { AssertionContext } from "@dec-bench/eval-core";

export async function scan_query_under_100ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT event_type, count() AS n, sum(value) AS total FROM analytics.events GROUP BY event_type",
    format: "JSONEachRow",
  });
  return Date.now() - start < 100;
}
