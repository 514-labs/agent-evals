import type { AssertionContext } from "@dec-bench/eval-core";

export async function daily_aggregation_under_200ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query:
      "SELECT * FROM analytics.daily_sessions ORDER BY day DESC LIMIT 30",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  return elapsed < 200;
}
