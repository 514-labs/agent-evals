import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function handles_null_json_fields(ctx: AssertionContext): Promise<AssertionResult> {
  const source = await ctx.pg.query(
    "SELECT count(*) AS n FROM raw.events WHERE payload->>'session_id' IS NULL OR payload->>'value' IS NULL",
  );
  const nullCount = Number(source.rows[0]?.n ?? 0);
  if (nullCount === 0) {
    return { passed: true, message: "No null JSON fields to handle.", details: { nullCount } };
  }

  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.daily_sessions",
  );
  const martCount = Number(rows[0]?.n ?? 0);
  const passed = martCount > 0;
  return {
    passed,
    message: passed ? "Handles null JSON fields." : "Mart empty despite nulls in source.",
    details: { nullCount, martCount },
  };
}
