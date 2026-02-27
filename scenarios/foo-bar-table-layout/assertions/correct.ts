import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_preserved(ctx: AssertionContext): Promise<boolean> {
  const src = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM raw.metrics");
  const dst = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.metrics_optimized");
  return Number(src[0]?.n ?? 0) === Number(dst[0]?.n ?? 0);
}

export async function value_checksum_matches(ctx: AssertionContext): Promise<boolean> {
  const src = await queryRows<{ s: number }>(ctx, "SELECT round(sum(value), 2) AS s FROM raw.metrics");
  const dst = await queryRows<{ s: number }>(ctx, "SELECT round(sum(value), 2) AS s FROM analytics.metrics_optimized");
  return Math.abs(Number(src[0]?.s ?? 0) - Number(dst[0]?.s ?? 0)) < 1;
}
