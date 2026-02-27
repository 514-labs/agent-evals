import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function connection_env_vars_available(ctx: AssertionContext): Promise<boolean> {
  return Boolean(ctx.env("POSTGRES_URL") && ctx.env("CLICKHOUSE_URL"));
}

export async function no_hardcoded_credentials(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ engine_full: string }>(
    ctx,
    "SELECT engine_full FROM system.tables WHERE database = 'analytics' AND name = 'orders'",
  );
  const engineDef = rows[0]?.engine_full ?? "";
  const hasHardcoded = /password|passwd|secret/i.test(engineDef);
  return !hasHardcoded;
}
