import type { AssertionContext } from "@dec-bench/eval-core";

export async function queries_return_results(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM analytics.events_log",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0) > 0;
}
