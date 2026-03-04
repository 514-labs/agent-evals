import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
  const passed = hasPostgres;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing POSTGRES_URL.",
    details: { hasPostgres },
  };
}
