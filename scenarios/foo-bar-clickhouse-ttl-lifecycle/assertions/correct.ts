import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function table_has_ttl(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ create_table_query: string }>(
    ctx,
    "SELECT create_table_query FROM system.tables WHERE database = 'analytics' AND name = 'raw_events'",
  );
  const query = rows[0]?.create_table_query ?? "";
  const hasTtl = /TTL\s+event_ts|TTL\s+\w+\s*\+|ttl/i.test(query);
  const has90 = /90|interval\s+90/i.test(query);
  const passed = hasTtl && has90;
  return {
    passed,
    message: passed ? "Table has TTL (90 days)." : "Table missing TTL or wrong interval.",
    details: { hasTtl, has90 },
  };
}
