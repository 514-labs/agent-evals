import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function row_count_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.events");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 720;
  return {
    passed,
    message: passed ? "Row count preserved." : `Expected at least 720 rows, got ${count}.`,
    details: { count },
  };
}
