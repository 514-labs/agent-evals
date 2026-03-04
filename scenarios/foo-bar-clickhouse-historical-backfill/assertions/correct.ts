import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_matches_staging(ctx: AssertionContext): Promise<AssertionResult> {
  const stagingRows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM staging.historical_events");
  const targetRows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const stagingCount = Number(stagingRows[0]?.n ?? 0);
  const targetCount = Number(targetRows[0]?.n ?? 0);
  const passed = stagingCount === targetCount;
  return {
    passed,
    message: passed ? "Row count matches staging." : `Staging ${stagingCount}, target ${targetCount}.`,
    details: { stagingCount, targetCount },
  };
}
