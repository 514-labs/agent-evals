import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function null_weight_on_existing_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query(
    "SELECT count(*) AS n FROM app.products WHERE weight_kg IS NULL",
  );
  const nullCount = Number(pgResult.rows[0]?.n ?? 0);
  const passed = nullCount === 20;
  return {
    passed,
    message: passed ? "Null weight on existing rows." : `Expected 20 nulls, got ${nullCount}.`,
    details: { nullCount },
  };
}

export async function ch_handles_null_weight(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.products WHERE weight_kg = 0 OR weight_kg IS NULL",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 20;
  return {
    passed,
    message: passed ? "CH handles null weight." : `Expected >=20, got ${count}.`,
    details: { count },
  };
}
