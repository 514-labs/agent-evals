import type { AssertionContext } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<boolean> {
  return Boolean(ctx.env("CLICKHOUSE_URL"));
}

export async function no_temporary_tables(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name LIKE '%tmp%'",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0) === 0;
}
