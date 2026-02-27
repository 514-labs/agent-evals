import type { AssertionContext } from "@dec-bench/eval-core";

export async function schema_has_constraints(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.pg.query(
    "SELECT count(*) AS n FROM information_schema.table_constraints WHERE table_schema = 'app' AND table_name = 'users' AND constraint_type = 'PRIMARY KEY'",
  );
  return Number(result.rows[0]?.n ?? 0) >= 1;
}
