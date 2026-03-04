import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

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
