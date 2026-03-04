import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasRedpanda = Boolean(ctx.env("REDPANDA_BROKER"));
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasRedpanda && hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing REDPANDA_BROKER or CLICKHOUSE_URL.",
    details: { hasRedpanda, hasClickHouse },
  };
}
