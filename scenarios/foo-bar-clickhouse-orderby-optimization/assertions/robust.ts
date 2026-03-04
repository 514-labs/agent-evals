import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 2000000;
  return {
    passed,
    message: passed ? "Row count preserved." : `Expected 2000000, got ${count}.`,
    details: { count },
  };
}
