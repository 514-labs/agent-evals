import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function no_data_loss(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT uniq(event_id) AS n FROM analytics.events_log",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 9900000;
  return {
    passed,
    message: passed ? "No data loss." : `Expected >=9900000 unique events, got ${count}.`,
    details: { count },
  };
}
