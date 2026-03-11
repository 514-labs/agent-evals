import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function date_range_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query(
    "SELECT count(*) FROM app.events WHERE created_at >= '2026-01-15' AND created_at < '2026-01-16'",
  );
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Date range query under 200ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
