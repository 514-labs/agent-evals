import type { AssertionContext } from "@dec-bench/eval-core";

export async function users_table_exists(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.pg.query(
    "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'users'",
  );
  return Number(result.rows[0]?.n ?? 0) === 1;
}

export async function table_has_rows(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.users");
  return Number(result.rows[0]?.n ?? 0) > 0;
}
