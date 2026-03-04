import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function index_on_user_id_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(`
    SELECT count(*) AS n FROM pg_indexes
    WHERE schemaname = 'app' AND tablename = 'orders'
    AND indexdef ILIKE '%user_id%'
  `);
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 1;
  return {
    passed,
    message: passed ? "Index on user_id exists." : "No index on user_id found.",
    details: { count },
  };
}

export async function index_on_created_at_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(`
    SELECT count(*) AS n FROM pg_indexes
    WHERE schemaname = 'app' AND tablename = 'orders'
    AND indexdef ILIKE '%created_at%'
  `);
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 1;
  return {
    passed,
    message: passed ? "Index on created_at exists." : "No index on created_at found.",
    details: { count },
  };
}
