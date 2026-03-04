import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_duplicate_event_ids(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number; total: number }>(
    ctx,
    "SELECT uniq(event_id) AS n, count() AS total FROM analytics.events_sink",
  );
  const uniq = Number(rows[0]?.n ?? 0);
  const total = Number(rows[0]?.total ?? 0);
  const passed = total === 0 || uniq === total;
  return {
    passed,
    message: passed ? "No duplicate event IDs." : `Found ${total - uniq} duplicates.`,
    details: { uniq, total },
  };
}
