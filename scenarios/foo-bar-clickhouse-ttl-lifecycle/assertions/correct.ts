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
  const ddl = rows[0]?.create_table_query ?? "";

  const hasTtlClause = /TTL\s+\w+/i.test(ddl);
  // Match various representations: INTERVAL 90 DAY, toIntervalDay(90), + 90, 90 DAY
  const has90DayInterval =
    /INTERVAL\s+90\s+DAY/i.test(ddl) ||
    /toIntervalDay\s*\(\s*90\s*\)/i.test(ddl) ||
    /\+\s*90/i.test(ddl) ||
    /90\s*DAY/i.test(ddl);
  const passed = hasTtlClause && has90DayInterval;
  return {
    passed,
    message: passed ? "Table has TTL with 90-day interval." : "Table missing TTL or wrong interval.",
    details: { hasTtlClause, has90DayInterval },
  };
}
