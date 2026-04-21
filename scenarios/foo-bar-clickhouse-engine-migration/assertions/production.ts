import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing CLICKHOUSE_URL.",
    details: { hasClickHouse },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
