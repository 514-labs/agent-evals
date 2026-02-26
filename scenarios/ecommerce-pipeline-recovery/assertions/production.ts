import type { AssertionContext } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<boolean> {
  return Boolean(ctx.env("POSTGRES_URL") && ctx.env("CLICKHOUSE_URL"));
}

export async function daily_grain_enforced(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.clickhouse.query({
    query:
      "SELECT count() AS n FROM analytics.fct_orders_daily WHERE toDate(order_day) != order_day",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0) === 0;
}
