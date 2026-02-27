import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_duplicate_header_rows(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_id = 'event_id'",
  );
  return Number(rows[0]?.n ?? 0) === 0;
}

export async function null_values_handled(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ min_val: number }>(
    ctx,
    "SELECT min(value) AS min_val FROM analytics.events",
  );
  return Number(rows[0]?.min_val ?? -1) >= 0;
}
