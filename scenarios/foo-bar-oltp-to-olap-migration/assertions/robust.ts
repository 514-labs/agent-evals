import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function required_columns_present(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'sales'",
  );
  const names = rows.map((r) => r.name);
  const required = ["id", "product_id", "quantity", "amount", "sale_date"];
  const missing = required.filter((c) => !names.includes(c));
  const passed = missing.length === 0;
  return {
    passed,
    message: passed ? "Required columns present." : `Missing: ${missing.join(", ")}.`,
    details: { names, missing },
  };
}
