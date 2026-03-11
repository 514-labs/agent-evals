import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function redpanda_broker_env_available(ctx: AssertionContext): Promise<AssertionResult> {
  const broker = ctx.env("REDPANDA_BROKER");
  const passed = Boolean(broker);
  return {
    passed,
    message: passed ? "REDPANDA_BROKER env available." : "REDPANDA_BROKER not set.",
    details: { hasBroker: !!broker },
  };
}
