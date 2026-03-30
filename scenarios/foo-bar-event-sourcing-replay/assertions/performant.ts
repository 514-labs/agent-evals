import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function snapshot_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query("SELECT * FROM app.order_snapshots");
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Snapshot query under 100ms." : `Query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
