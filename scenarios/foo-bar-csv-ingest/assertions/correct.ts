import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function all_fifteen_events_loaded(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  return Number(rows[0]?.n ?? 0) === 15;
}

export async function no_null_event_ids(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_id = '' OR event_id IS NULL",
  );
  return Number(rows[0]?.n ?? 0) === 0;
}

export async function dates_are_valid(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_ts < '2026-01-01' OR event_ts > '2026-12-31'",
  );
  return Number(rows[0]?.n ?? 0) === 0;
}
