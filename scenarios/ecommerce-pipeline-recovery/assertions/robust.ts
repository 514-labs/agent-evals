import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function deduplication_applied(ctx: AssertionContext): Promise<boolean> {
  const source = await ctx.pg.query("SELECT count(DISTINCT order_id) AS n FROM raw.orders");
  const targetRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT sum(order_count) AS n FROM analytics.fct_orders_daily",
  );
  return Number(targetRows[0]?.n ?? 0) === Number(source.rows[0]?.n ?? 0);
}

export async function idempotent_shape(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.fct_orders_daily WHERE order_count < 0 OR daily_revenue < 0",
  );
  return Number(rows[0]?.n ?? 0) === 0;
}
