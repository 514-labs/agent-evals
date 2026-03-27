import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function replay_is_idempotent(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.order_snapshots");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 3;
  return {
    passed,
    message: passed ? "Replay produced correct row count." : "Row count incorrect after replay.",
    details: { count },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
