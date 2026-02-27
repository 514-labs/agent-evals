import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function handles_null_json_fields(ctx: AssertionContext): Promise<boolean> {
  const source = await ctx.pg.query(
    "SELECT count(*) AS n FROM raw.events WHERE payload->>'session_id' IS NULL OR payload->>'value' IS NULL",
  );
  const nullCount = Number(source.rows[0]?.n ?? 0);
  if (nullCount === 0) return true;

  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.daily_sessions",
  );
  return Number(rows[0]?.n ?? 0) > 0;
}
