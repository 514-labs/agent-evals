import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function has_partition_or_order_optimized(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ partition_key: string; sorting_key: string }>(
    ctx,
    "SELECT partition_key, sorting_key FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const pk = rows[0]?.partition_key ?? "";
  const sk = rows[0]?.sorting_key ?? "";
  const hasPartition = pk !== "" && pk !== "tuple()";
  const hasOrder = sk !== "" && sk !== "tuple()" && sk.includes("event");
  const passed = hasPartition || hasOrder;
  return {
    passed,
    message: passed ? "Table has partition or order optimized." : "Table layout not optimized.",
    details: { partitionKey: pk, sortingKey: sk },
  };
}
