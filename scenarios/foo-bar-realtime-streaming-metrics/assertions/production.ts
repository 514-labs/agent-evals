import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

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

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}
