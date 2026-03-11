import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function mv_refreshes_on_insert(ctx: AssertionContext): Promise<AssertionResult> {
  await ctx.clickhouse.command({
    query: "INSERT INTO analytics.raw_events VALUES ('e_new', '2026-01-17 12:00:00', 'pageview', 'u99')",
  });
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT event_count AS n FROM analytics.daily_event_summary WHERE day = '2026-01-17' AND event_type = 'pageview'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 1;
  return {
    passed,
    message: passed ? "MV refreshes on insert." : "MV did not reflect new insert.",
    details: { count },
  };
}
