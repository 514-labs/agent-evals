import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function event_count_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const sourceRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.raw_events",
  );
  const targetRows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(event_count) AS s FROM analytics.daily_event_summary",
  );
  const sourceCount = Number(sourceRows[0]?.n ?? 0);
  const targetCount = Number(targetRows[0]?.s ?? 0);
  const passed = sourceCount === targetCount;
  return {
    passed,
    message: passed ? "Event count matches source." : `Source ${sourceCount}, target ${targetCount}.`,
    details: { sourceCount, targetCount },
  };
}

export async function has_event_count_column(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'daily_event_summary' AND name = 'event_count'",
  );
  const passed = rows.length === 1;
  return {
    passed,
    message: passed ? "event_count column exists." : "event_count column missing.",
    details: { columnCount: rows.length },
  };
}
