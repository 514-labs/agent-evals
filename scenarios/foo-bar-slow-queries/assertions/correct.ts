import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function total_row_count_unchanged(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events_log");
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 10000000;
  return {
    passed,
    message: passed ? "Total row count unchanged." : `Expected 10000000, got ${count}.`,
    details: { count },
  };
}
