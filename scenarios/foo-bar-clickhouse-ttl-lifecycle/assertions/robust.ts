import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function table_has_event_ts_column(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'raw_events'",
  );
  const names = rows.map((r) => r.name);
  const hasEventTs = names.includes("event_ts");
  return {
    passed: hasEventTs,
    message: hasEventTs ? "Table has event_ts column." : `Missing event_ts. Got: ${JSON.stringify(names)}.`,
    details: { names },
  };
}
