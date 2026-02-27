import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function count_matches_unique_order_ids(ctx: AssertionContext): Promise<boolean> {
  const source = await ctx.pg.query("SELECT count(DISTINCT order_id) AS n FROM raw.orders");
  const targetRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.orders FINAL",
  );
  const sourceCount = Number(source.rows[0]?.n ?? 0);
  const targetCount = Number(targetRows[0]?.n ?? 0);
  return targetCount === sourceCount;
}
