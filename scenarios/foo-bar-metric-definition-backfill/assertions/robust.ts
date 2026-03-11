import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_duplicate_days(ctx: AssertionContext): Promise<AssertionResult> {
  const dupRows = await queryRows<{ day: string; cnt: number }>(
    ctx,
    "SELECT day, count() AS cnt FROM analytics.metric_daily GROUP BY day HAVING count() > 1",
  );
  const passed = dupRows.length === 0;
  return {
    passed,
    message: passed ? "No duplicate days." : `Found ${dupRows.length} days with duplicates.`,
    details: { duplicateDayCount: dupRows.length },
  };
}
