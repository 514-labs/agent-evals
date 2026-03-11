import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function pg_weight_column_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'products' AND column_name = 'weight_kg'",
  );
  const passed = result.rows.length === 1;
  return {
    passed,
    message: passed ? "PG weight_kg column exists." : "PG weight_kg column not found.",
    details: { found: result.rows.length },
  };
}

export async function ch_weight_column_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.columns WHERE database = 'analytics' AND table = 'products' AND name = 'weight_kg'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "CH weight_kg column exists." : `Expected 1, got ${count}.`,
    details: { count },
  };
}
