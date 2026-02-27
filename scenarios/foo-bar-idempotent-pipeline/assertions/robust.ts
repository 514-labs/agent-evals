import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function idempotent_row_count(ctx: AssertionContext): Promise<boolean> {
  const firstRun = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.orders FINAL",
  );
  const countAfterFirstCheck = Number(firstRun[0]?.n ?? 0);

  const source = await ctx.pg.query("SELECT count(DISTINCT order_id) AS n FROM raw.orders");
  const sourceCount = Number(source.rows[0]?.n ?? 0);

  return countAfterFirstCheck === sourceCount;
}
