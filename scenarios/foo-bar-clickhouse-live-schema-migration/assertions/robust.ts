import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function select_star_works(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT * FROM analytics.events LIMIT 1",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Record<string, unknown>[];
  const passed = rows.length === 1 && rows[0] && Object.keys(rows[0]).length >= 4;
  return {
    passed,
    message: passed ? "SELECT * works." : "SELECT * failed or returned wrong shape.",
    details: { rowCount: rows.length },
  };
}
