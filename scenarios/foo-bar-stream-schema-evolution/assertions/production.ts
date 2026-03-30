import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function redpanda_broker_env_available(ctx: AssertionContext): Promise<AssertionResult> {
  const broker = ctx.env("REDPANDA_BROKER");
  const passed = Boolean(broker);
  return {
    passed,
    message: passed ? "REDPANDA_BROKER env available." : "REDPANDA_BROKER not set.",
    details: { hasBroker: !!broker },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}
