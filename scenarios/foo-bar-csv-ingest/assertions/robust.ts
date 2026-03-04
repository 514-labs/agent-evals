import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_duplicate_header_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_id = 'event_id'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No duplicate header rows." : `Found ${count} header rows.`,
    details: { count },
  };
}

export async function null_values_handled(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ min_val: number }>(
    ctx,
    "SELECT min(value) AS min_val FROM analytics.events",
  );
  const minVal = Number(rows[0]?.min_val ?? -1);
  const passed = minVal >= 0;
  return {
    passed,
    message: passed ? "Null values handled." : `Min value ${minVal} indicates null handling issue.`,
    details: { minVal },
  };
}
