import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function users_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'users'",
  );
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Users table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}

export async function table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.users");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Table has rows." : "Table is empty.",
    details: { count },
  };
}
