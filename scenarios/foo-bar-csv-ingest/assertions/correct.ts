import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function all_fifteen_events_loaded(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 15;
  return {
    passed,
    message: passed ? "All 15 events loaded." : `Expected 15, got ${count}.`,
    details: { count },
  };
}

export async function no_null_event_ids(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_id = '' OR event_id IS NULL",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No null event IDs." : `Found ${count} null/empty event IDs.`,
    details: { count },
  };
}

export async function dates_are_valid(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_ts < '2026-01-01' OR event_ts > '2026-12-31'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "Dates are valid." : `Found ${count} out-of-range dates.`,
    details: { count },
  };
}
