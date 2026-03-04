import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function rollup_tables_exist(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name IN ('rollup_hourly', 'rollup_daily', 'rollup_monthly')",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 2;
  return {
    passed,
    message: passed ? "Rollup tables exist." : `Expected at least 2 rollup tables, got ${count}.`,
    details: { count },
  };
}

export async function rollups_have_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const dailyRows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.rollup_daily");
  const count = Number(dailyRows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Rollups have rows." : "Rollups are empty.",
    details: { count },
  };
}
