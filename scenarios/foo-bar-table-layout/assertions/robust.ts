import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function has_partition_key(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ partition_key: string }>(
    ctx,
    "SELECT partition_key FROM system.tables WHERE database = 'analytics' AND name = 'metrics_optimized'",
  );
  const key = rows[0]?.partition_key ?? "";
  return key.length > 0 && key !== "tuple()";
}

export async function has_non_trivial_order_key(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    "SELECT sorting_key FROM system.tables WHERE database = 'analytics' AND name = 'metrics_optimized'",
  );
  const key = rows[0]?.sorting_key ?? "";
  return key.length > 0 && key !== "tuple()";
}
