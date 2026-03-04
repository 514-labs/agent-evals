import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function all_rows_have_region(ctx: AssertionContext): Promise<AssertionResult> {
  const total = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const withRegion = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE region != '' AND region IS NOT NULL",
  );
  const totalCount = Number(total[0]?.n ?? 0);
  const regionCount = Number(withRegion[0]?.n ?? 0);
  const passed = totalCount > 0 && regionCount === totalCount;
  return {
    passed,
    message: passed ? "All rows have region." : `${regionCount}/${totalCount} rows have region.`,
    details: { totalCount, regionCount },
  };
}
