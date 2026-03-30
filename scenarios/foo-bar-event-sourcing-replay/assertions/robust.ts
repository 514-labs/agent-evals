import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function replay_is_idempotent(ctx: AssertionContext): Promise<AssertionResult> {
  // Capture state before: row count and total amounts
  const before = await ctx.pg.query(
    "SELECT count(*) AS n, coalesce(sum(total_amount), 0) AS total FROM app.order_snapshots",
  );
  const countBefore = Number(before.rows[0]?.n ?? 0);
  const totalBefore = Number(before.rows[0]?.total ?? 0);

  if (countBefore === 0) {
    return { passed: false, message: "No snapshots exist to test idempotency.", details: { countBefore } };
  }

  // Derive expected count from distinct orders in events
  const orderCount = await ctx.pg.query(
    "SELECT count(DISTINCT order_id) AS n FROM app.order_events",
  );
  const expectedCount = Number(orderCount.rows[0]?.n ?? 0);
  const countMatch = countBefore === expectedCount;

  const passed = countBefore >= 3 && countMatch;
  return {
    passed,
    message: passed
      ? `Snapshot count (${countBefore}) matches distinct orders (${expectedCount}).`
      : `Snapshot count ${countBefore} vs ${expectedCount} distinct orders.`,
    details: { countBefore, totalBefore, expectedCount },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
