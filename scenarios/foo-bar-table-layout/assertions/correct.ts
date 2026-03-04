import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const src = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM raw.metrics");
  const dst = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.metrics_optimized");
  const srcCount = Number(src[0]?.n ?? 0);
  const dstCount = Number(dst[0]?.n ?? 0);
  const passed = srcCount === dstCount;
  return {
    passed,
    message: passed ? "Row count preserved." : `Source ${srcCount}, target ${dstCount}.`,
    details: { srcCount, dstCount },
  };
}

export async function value_checksum_matches(ctx: AssertionContext): Promise<AssertionResult> {
  const src = await queryRows<{ s: number }>(ctx, "SELECT round(sum(value), 2) AS s FROM raw.metrics");
  const dst = await queryRows<{ s: number }>(ctx, "SELECT round(sum(value), 2) AS s FROM analytics.metrics_optimized");
  const srcSum = Number(src[0]?.s ?? 0);
  const dstSum = Number(dst[0]?.s ?? 0);
  const passed = Math.abs(srcSum - dstSum) < 1;
  return {
    passed,
    message: passed ? "Value checksum matches." : `Source ${srcSum}, target ${dstSum}.`,
    details: { srcSum, dstSum },
  };
}
