import type { AssertionContext } from "@dec-bench/eval-core";

export async function select_query_under_100ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT id, name, price, category, weight_kg FROM analytics.products ORDER BY id",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  return elapsed < 100;
}
