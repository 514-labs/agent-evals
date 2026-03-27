import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function row_count_unchanged(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.orders");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 500000;
  return {
    passed,
    message: passed ? "Row count unchanged." : `Expected 500000, got ${count}.`,
    details: { count },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
