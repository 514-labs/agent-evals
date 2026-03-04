import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function user_id_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query("SELECT * FROM app.orders WHERE user_id = 'user_42' ORDER BY created_at DESC LIMIT 10");
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? "User ID query under 50ms." : `User ID query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function created_at_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query("SELECT * FROM app.orders WHERE created_at >= '2025-02-01' AND created_at < '2025-03-01' ORDER BY created_at");
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? "Created_at query under 50ms." : `Created_at query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
