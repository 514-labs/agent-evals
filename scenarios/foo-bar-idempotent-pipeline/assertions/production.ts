import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasPostgres && hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing POSTGRES_URL or CLICKHOUSE_URL.",
    details: { hasPostgres, hasClickHouse },
  };
}

export async function no_hardcoded_credentials(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ engine_full: string }>(
    ctx,
    "SELECT engine_full FROM system.tables WHERE database = 'analytics' AND name = 'orders'",
  );
  const engineDef = rows[0]?.engine_full ?? "";
  const hasHardcoded = /password|passwd|secret/i.test(engineDef);
  const passed = !hasHardcoded;
  return {
    passed,
    message: passed ? "No hardcoded credentials." : "Engine definition contains suspect patterns.",
    details: { hasHardcoded },
  };
}
