import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function raw_events_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'raw_events'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Raw events table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}

export async function table_has_expected_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string; type: string }>(
    ctx,
    "SELECT name, type FROM system.columns WHERE database = 'analytics' AND table = 'raw_events'",
  );
  const names = rows.map((r) => r.name);
  const hasTimestamp = names.some((n) => ["event_ts", "timestamp", "created_at"].includes(n));
  const passed = rows.length >= 3 && hasTimestamp;
  return {
    passed,
    message: passed
      ? `Table has ${rows.length} columns including a timestamp column.`
      : `Table has ${rows.length} columns, timestamp column ${hasTimestamp ? "found" : "missing"}.`,
    details: { columnCount: rows.length, columns: names, hasTimestamp },
  };
}
