import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function session_count_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const source = await ctx.pg.query(
    "SELECT count(DISTINCT payload->>'session_id') AS n FROM raw.events WHERE payload->>'session_id' IS NOT NULL",
  );
  const targetRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT sum(session_count) AS n FROM analytics.daily_sessions",
  );
  const sourceCount = Number(source.rows[0]?.n ?? 0);
  const targetCount = Number(targetRows[0]?.n ?? 0);
  const passed = targetCount === sourceCount;
  return {
    passed,
    message: passed ? "Session count matches source." : `Source ${sourceCount}, target ${targetCount}.`,
    details: { sourceCount, targetCount },
  };
}

export async function revenue_checksum(ctx: AssertionContext): Promise<AssertionResult> {
  const source = await ctx.pg.query(
    "SELECT coalesce(sum((payload->>'value')::numeric), 0) AS s FROM raw.events WHERE payload->>'value' IS NOT NULL",
  );
  const targetRows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(total_revenue) AS s FROM analytics.daily_sessions",
  );
  const sourceSum = Number(source.rows[0]?.s ?? 0);
  const targetSum = Number(targetRows[0]?.s ?? 0);
  const passed = Math.abs(sourceSum - targetSum) < 0.01;
  return {
    passed,
    message: passed ? "Revenue checksum matches." : `Source ${sourceSum}, target ${targetSum}.`,
    details: { sourceSum, targetSum },
  };
}
