import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing CLICKHOUSE_URL.",
    details: { hasClickHouse },
  };
}

export async function no_temporary_tables(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name LIKE '%tmp%'",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No temporary tables." : `Found ${count} tmp tables.`,
    details: { count },
  };
}
