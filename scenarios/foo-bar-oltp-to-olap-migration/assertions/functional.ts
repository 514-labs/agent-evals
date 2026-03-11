import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function sales_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'sales'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Sales table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}

export async function sales_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.sales",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 15;
  return {
    passed,
    message: passed ? `Sales table has ${count} rows.` : `Expected >=15 rows, got ${count}.`,
    details: { count },
  };
}
