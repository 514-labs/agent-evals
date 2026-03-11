import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function orders_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'orders'",
  );
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Orders table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}

export async function orders_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.orders");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 500000;
  return {
    passed,
    message: passed ? "Orders table has rows." : `Expected >=500000, got ${count}.`,
    details: { count },
  };
}
