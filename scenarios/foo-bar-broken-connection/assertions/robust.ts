import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function schema_has_constraints(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT count(*) AS n FROM information_schema.table_constraints WHERE table_schema = 'app' AND table_name = 'users' AND constraint_type = 'PRIMARY KEY'",
  );
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count >= 1;
  return {
    passed,
    message: passed ? "Schema has constraints." : "No primary key constraint found.",
    details: { constraintCount: count },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
