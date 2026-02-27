import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function mart_table_exists(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'daily_sessions'",
  );
  return Number(rows[0]?.n ?? 0) === 1;
}

export async function mart_has_rows(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.daily_sessions",
  );
  return Number(rows[0]?.n ?? 0) > 0;
}
