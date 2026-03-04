import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function metric_daily_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'metric_daily'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Metric daily table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}

export async function metric_daily_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.metric_daily");
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Metric daily has rows." : "Metric daily is empty.",
    details: { count },
  };
}
