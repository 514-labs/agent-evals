import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  return {
    passed: hasClickHouse,
    message: hasClickHouse ? "Connection env vars available." : "Missing CLICKHOUSE_URL.",
    details: { hasClickHouse },
  };
}
