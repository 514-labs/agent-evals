import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function order_snapshots_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'order_snapshots'",
  );
  const passed = result.rows.length === 1;
  return {
    passed,
    message: passed ? "Order snapshots table exists." : "Table not found.",
    details: { found: result.rows.length },
  };
}

export async function order_snapshots_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.order_snapshots");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 3;
  return {
    passed,
    message: passed ? `Order snapshots has ${count} rows.` : `Expected >=3 rows, got ${count}.`,
    details: { count },
  };
}
