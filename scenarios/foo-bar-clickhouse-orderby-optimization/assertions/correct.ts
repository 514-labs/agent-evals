import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function order_by_includes_region(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    "SELECT sorting_key FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const sortingKey = rows[0]?.sorting_key ?? "";
  const columns = sortingKey.split(",").map((c) => c.trim().toLowerCase());
  const hasRegion = columns.includes("region");
  const hasEventTs = columns.includes("event_ts");
  const regionFirst = hasRegion && hasEventTs && columns.indexOf("region") < columns.indexOf("event_ts");
  const passed = hasRegion && hasEventTs;
  return {
    passed,
    message: passed
      ? `ORDER BY includes region and event_ts${regionFirst ? " (region is prefix)" : ""}.`
      : `ORDER BY does not match filter columns. sorting_key: ${sortingKey}`,
    details: { sortingKey, columns, hasRegion, hasEventTs, regionFirst },
  };
}
