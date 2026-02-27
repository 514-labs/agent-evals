import type { AssertionContext } from "@dec-bench/eval-core";

export async function select_query_under_50ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.pg.query("SELECT * FROM app.users");
  return Date.now() - start < 50;
}
