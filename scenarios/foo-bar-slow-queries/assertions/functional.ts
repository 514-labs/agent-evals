import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function queries_return_results(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM analytics.events_log",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Queries return results." : "Table is empty.",
    details: { count },
  };
}
