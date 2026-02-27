import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function quality_results_stored(ctx: AssertionContext): Promise<boolean> {
  // Check if quality check results exist in either Postgres or ClickHouse
  const pgCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM information_schema.tables
    WHERE table_name LIKE '%quality%' OR table_name LIKE '%dq%' OR table_name LIKE '%check%'
  `);
  if (Number(pgCheck.rows[0]?.n ?? 0) > 0) return true;

  const chCheck = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE name LIKE '%quality%' OR name LIKE '%dq%' OR name LIKE '%check%'",
  );
  return Number(chCheck[0]?.n ?? 0) > 0;
}
