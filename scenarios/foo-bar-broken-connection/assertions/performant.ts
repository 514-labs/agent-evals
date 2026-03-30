import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function select_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.pg.query("SELECT * FROM app.users");
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? "Select query under 50ms." : `Select query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
