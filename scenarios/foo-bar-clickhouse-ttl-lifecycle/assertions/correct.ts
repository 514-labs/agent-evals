import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function table_has_ttl(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ engine_full: string }>(
    ctx,
    "SELECT engine_full FROM system.tables WHERE database = 'analytics' AND name = 'raw_events'",
  );
  const engineFull = rows[0]?.engine_full ?? "";

  // Also check the create_table_query for TTL clause since engine_full may not surface TTL in all engines
  const ddlRows = await queryRows<{ create_table_query: string }>(
    ctx,
    "SELECT create_table_query FROM system.tables WHERE database = 'analytics' AND name = 'raw_events'",
  );
  const ddl = ddlRows[0]?.create_table_query ?? "";

  // Look for TTL in either source — must reference a time column and a 90-day interval
  const combined = `${engineFull}\n${ddl}`;
  const hasTtlClause = /TTL\s+\w+/i.test(combined);
  // Match various representations: INTERVAL 90 DAY, toIntervalDay(90), + 90, etc.
  const has90DayInterval =
    /INTERVAL\s+90\s+DAY/i.test(combined) ||
    /toIntervalDay\s*\(\s*90\s*\)/i.test(combined) ||
    /\+\s*90/i.test(combined) ||
    /90\s*DAY/i.test(combined);
  const passed = hasTtlClause && has90DayInterval;
  return {
    passed,
    message: passed ? "Table has TTL with 90-day interval." : "Table missing TTL or wrong interval.",
    details: { engineFull, hasTtlClause, has90DayInterval },
  };
}
