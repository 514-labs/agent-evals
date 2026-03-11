import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasPostgres && hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing POSTGRES_URL or CLICKHOUSE_URL.",
    details: { hasPostgres, hasClickHouse },
  };
}

export async function daily_grain_enforced(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query:
      "SELECT count() AS n FROM analytics.fct_orders_daily WHERE toDate(order_day) != order_day",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "Daily grain enforced." : `Found ${count} rows with non-date grain.`,
    details: { count },
  };
}
