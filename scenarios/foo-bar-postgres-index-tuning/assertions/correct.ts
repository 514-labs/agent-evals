import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function index_on_user_id_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(`
    SELECT 1 FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'app' AND t.relname = 'orders' AND a.attname = 'user_id'
    LIMIT 1
  `);
  const passed = result.rows.length >= 1;
  return {
    passed,
    message: passed ? "Index on user_id exists." : "No index on user_id found.",
    details: { found: result.rows.length },
  };
}

export async function index_on_created_at_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(`
    SELECT 1 FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'app' AND t.relname = 'orders' AND a.attname = 'created_at'
    LIMIT 1
  `);
  const passed = result.rows.length >= 1;
  return {
    passed,
    message: passed ? "Index on created_at exists." : "No index on created_at found.",
    details: { found: result.rows.length },
  };
}
