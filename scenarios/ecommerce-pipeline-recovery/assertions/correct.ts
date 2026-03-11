import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_counts_match(ctx: AssertionContext): Promise<AssertionResult> {
  const source = await ctx.pg.query("SELECT count(DISTINCT order_id) AS n FROM raw.orders");
  const targetRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT sum(order_count) AS n FROM analytics.fct_orders_daily",
  );
  const sourceCount = Number(source.rows[0]?.n ?? 0);
  const targetCount = Number(targetRows[0]?.n ?? 0);
  const passed = targetCount === sourceCount;
  return {
    passed,
    message: passed ? "Row counts match." : `Source ${sourceCount}, target ${targetCount}.`,
    details: { sourceCount, targetCount },
  };
}

export async function revenue_checksum(ctx: AssertionContext): Promise<AssertionResult> {
  const source = await ctx.pg.query("SELECT sum(total_amount)::numeric AS s FROM raw.orders");
  const targetRows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(daily_revenue) AS s FROM analytics.fct_orders_daily",
  );
  const sourceSum = Number(source.rows[0]?.s ?? 0);
  const targetSum = Number(targetRows[0]?.s ?? 0);
  const passed = Math.abs(sourceSum - targetSum) < 0.001;
  return {
    passed,
    message: passed ? "Revenue checksum matches." : `Source ${sourceSum}, target ${targetSum}.`,
    details: { sourceSum, targetSum },
  };
}
