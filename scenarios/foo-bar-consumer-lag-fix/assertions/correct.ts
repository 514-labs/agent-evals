import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function sink_row_count_meets_threshold(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events_sink",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 9500;
  return {
    passed,
    message: passed ? "Sink has sufficient rows (>=9500)." : `Expected >=9500, got ${count}.`,
    details: { count },
  };
}
