import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function order_by_includes_region(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ create_table_query: string }>(
    ctx,
    "SELECT create_table_query FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const query = rows[0]?.create_table_query ?? "";
  const hasRegion = /ORDER BY.*region|order by.*region/i.test(query);
  const hasEventTs = /ORDER BY.*event_ts|order by.*event_ts/i.test(query);
  const passed = hasRegion && hasEventTs;
  return {
    passed,
    message: passed ? "ORDER BY includes region and event_ts." : "ORDER BY does not match filter columns.",
    details: { hasRegion, hasEventTs },
  };
}
