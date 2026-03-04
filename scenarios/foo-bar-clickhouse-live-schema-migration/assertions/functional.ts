import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function region_column_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'events' AND name = 'region'",
  );
  const passed = rows.length === 1;
  return {
    passed,
    message: passed ? "Region column exists." : "Region column missing.",
    details: { columnCount: rows.length },
  };
}

export async function table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Table has rows." : "Table is empty.",
    details: { count },
  };
}
