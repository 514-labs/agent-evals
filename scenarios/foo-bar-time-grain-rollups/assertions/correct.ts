import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function daily_total_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const sourceRows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.raw_events");
  const rollupRows = await queryRows<{ s: number }>(ctx, "SELECT sum(event_count) AS s FROM analytics.rollup_daily");
  const sourceCount = Number(sourceRows[0]?.n ?? 0);
  const rollupCount = Number(rollupRows[0]?.s ?? 0);
  const passed = sourceCount === rollupCount;
  return {
    passed,
    message: passed ? "Daily total matches source." : `Source ${sourceCount}, rollup ${rollupCount}.`,
    details: { sourceCount, rollupCount },
  };
}
