import type { AssertionContext } from "@dec-bench/eval-core";

export async function point_query_under_100ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.orders FINAL WHERE order_id = 'ord_050'",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  return elapsed < 100;
}
