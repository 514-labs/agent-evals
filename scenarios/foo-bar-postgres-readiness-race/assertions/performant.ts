import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function health_check_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query("SELECT 1");
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? "Health check under 50ms." : `Health check took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
