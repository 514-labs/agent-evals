import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
  const hasRedpanda = Boolean(ctx.env("REDPANDA_BROKER"));
  const passed = hasPostgres && hasRedpanda;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing POSTGRES_URL or REDPANDA_BROKER.",
    details: { hasPostgres, hasRedpanda },
  };
}
