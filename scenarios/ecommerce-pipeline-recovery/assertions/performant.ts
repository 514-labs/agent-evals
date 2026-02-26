import type { AssertionContext } from "@dec-bench/eval-core";

export async function dashboard_query_under_250ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query:
      "SELECT order_day, order_count, daily_revenue FROM analytics.fct_orders_daily ORDER BY order_day DESC LIMIT 30",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  return elapsed < 250;
}

export async function bounded_row_count(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM analytics.fct_orders_daily",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0) <= 366;
}
