import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function reconciliation_handles_empty(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT count(*) AS n FROM app.transactions");
  const pgCount = Number(pgResult.rows[0]?.n ?? 0);
  const passed = pgCount >= 10;
  return {
    passed,
    message: passed ? "Source has data." : "Source empty or insufficient.",
    details: { pgCount },
  };
}
