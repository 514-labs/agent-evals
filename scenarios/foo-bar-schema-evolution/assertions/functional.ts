import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function pg_weight_column_exists(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.pg.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'products' AND column_name = 'weight_kg'",
  );
  return result.rows.length === 1;
}

export async function ch_weight_column_exists(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.columns WHERE database = 'analytics' AND table = 'products' AND name = 'weight_kg'",
  );
  return Number(rows[0]?.n ?? 0) === 1;
}
