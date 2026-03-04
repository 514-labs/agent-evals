import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function health_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'health'",
  );
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Health table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}
