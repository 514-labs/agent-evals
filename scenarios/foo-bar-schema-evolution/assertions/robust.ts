import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function null_weight_on_existing_rows(ctx: AssertionContext): Promise<boolean> {
  const pgResult = await ctx.pg.query(
    "SELECT count(*) AS n FROM app.products WHERE weight_kg IS NULL",
  );
  const nullCount = Number(pgResult.rows[0]?.n ?? 0);
  return nullCount === 20;
}

export async function ch_handles_null_weight(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.products WHERE weight_kg = 0 OR weight_kg IS NULL",
  );
  return Number(rows[0]?.n ?? 0) >= 20;
}
