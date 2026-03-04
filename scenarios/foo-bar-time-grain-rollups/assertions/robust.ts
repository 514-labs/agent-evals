import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function hourly_or_monthly_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const hourly = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.rollup_hourly");
  const monthly = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.rollup_monthly");
  const hasHourly = Number(hourly[0]?.n ?? 0) > 0;
  const hasMonthly = Number(monthly[0]?.n ?? 0) > 0;
  const passed = hasHourly || hasMonthly;
  return {
    passed,
    message: passed ? "At least one additional grain exists." : "Missing hourly or monthly rollup data.",
    details: { hasHourly, hasMonthly },
  };
}
