import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function dashboard_query_under_250ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query:
      "SELECT order_day, order_count, daily_revenue FROM analytics.fct_orders_daily ORDER BY order_day DESC LIMIT 30",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 250;
  return {
    passed,
    message: passed ? "Dashboard query under 250ms." : `Dashboard query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function bounded_row_count(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM analytics.fct_orders_daily",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  const count = Number(rows[0]?.n ?? 0);
  const passed = count <= 366;
  return {
    passed,
    message: passed ? "Bounded row count." : `Row count ${count} exceeds 366.`,
    details: { count },
  };
}
