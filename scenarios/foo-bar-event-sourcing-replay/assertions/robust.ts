import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function replay_is_idempotent(ctx: AssertionContext): Promise<AssertionResult> {
  // Seed has 4 distinct orders (ord_001..ord_004). Verify exactly 4 snapshots with no duplicates.
  const result = await ctx.pg.query(`
    SELECT order_id, count(*) AS n FROM app.order_snapshots GROUP BY order_id HAVING count(*) > 1
  `);
  const duplicates = result.rows;

  const countResult = await ctx.pg.query("SELECT count(*) AS n FROM app.order_snapshots");
  const totalRows = Number(countResult.rows[0]?.n ?? 0);

  const passed = duplicates.length === 0 && totalRows === 4;
  return {
    passed,
    message: passed
      ? "No duplicate order snapshots (4 distinct orders)."
      : `${duplicates.length} duplicated order_ids, ${totalRows} total rows (expected 4).`,
    details: { totalRows, duplicates },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
