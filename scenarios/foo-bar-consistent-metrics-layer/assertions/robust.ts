import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function dau_is_distinct_users(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ day: string; dau: number }>(
    ctx,
    "SELECT day, dau FROM analytics.daily_metrics WHERE day = '2026-01-15'",
  );
  const dau = Number(rows[0]?.dau ?? 0);
  const passed = dau === 2;
  return {
    passed,
    message: passed ? "DAU is distinct users (2 on 2026-01-15)." : `Expected 2 distinct users, got ${dau}.`,
    details: { dau },
  };
}
