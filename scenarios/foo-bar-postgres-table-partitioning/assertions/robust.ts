import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function table_is_partitioned(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'app' AND c.relname = 'events'",
  );
  const relkind = result.rows[0]?.relkind ?? "";
  const isPartitioned = relkind === "p";
  const result2 = await ctx.pg.query(
    "SELECT count(*) AS n FROM pg_inherits i JOIN pg_class p ON i.inhparent = p.oid JOIN pg_class c ON i.inhrelid = c.oid JOIN pg_namespace n ON p.relnamespace = n.oid WHERE n.nspname = 'app' AND p.relname = 'events'",
  );
  const partitionCount = Number(result2.rows[0]?.n ?? 0);
  const passed = isPartitioned || partitionCount > 0;
  return {
    passed,
    message: passed ? "Table is partitioned." : "Table is not partitioned.",
    details: { relkind, partitionCount },
  };
}
