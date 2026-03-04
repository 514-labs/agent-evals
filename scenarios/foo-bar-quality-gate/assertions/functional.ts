import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function quality_results_stored(ctx: AssertionContext): Promise<AssertionResult> {
  const pgCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM information_schema.tables
    WHERE table_name LIKE '%quality%' OR table_name LIKE '%dq%' OR table_name LIKE '%check%'
  `);
  const pgCount = Number(pgCheck.rows[0]?.n ?? 0);
  if (pgCount > 0) {
    return { passed: true, message: "Quality results stored.", details: { pgCount } };
  }

  const chCheck = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE name LIKE '%quality%' OR name LIKE '%dq%' OR name LIKE '%check%'",
  );
  const chCount = Number(chCheck[0]?.n ?? 0);
  const passed = chCount > 0;
  return {
    passed,
    message: passed ? "Quality results stored." : "No quality/dq/check tables found.",
    details: { pgCount, chCount },
  };
}
