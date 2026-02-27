import type { AssertionContext } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<boolean> {
  return Boolean(ctx.env("POSTGRES_URL") && ctx.env("CLICKHOUSE_URL"));
}
