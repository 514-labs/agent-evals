import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function total_amount_matches_events(ctx: AssertionContext): Promise<AssertionResult> {
  // Derive expected sum from the event log instead of hardcoding
  const eventResult = await ctx.pg.query(`
    SELECT coalesce(sum(amount), 0) AS s FROM app.order_events
    WHERE order_id IN (SELECT DISTINCT order_id FROM app.order_snapshots WHERE status = 'active')
      AND event_type NOT IN ('order_cancelled', 'cancel')
  `);
  const expectedSum = Number(eventResult.rows[0]?.s ?? 0);

  const snapshotResult = await ctx.pg.query(
    "SELECT coalesce(sum(total_amount), 0) AS s FROM app.order_snapshots WHERE status = 'active'",
  );
  const snapshotSum = Number(snapshotResult.rows[0]?.s ?? 0);

  const passed = expectedSum > 0 && Math.abs(snapshotSum - expectedSum) < 0.01;
  return {
    passed,
    message: passed
      ? "Total amount matches replayed events."
      : `Snapshot sum ${snapshotSum} vs event-derived ${expectedSum}.`,
    details: { snapshotSum, expectedSum },
  };
}

export async function cancelled_order_has_zero_amount(ctx: AssertionContext): Promise<AssertionResult> {
  // Find any cancelled order dynamically instead of hardcoding ord_002
  const result = await ctx.pg.query(
    "SELECT order_id, total_amount FROM app.order_snapshots WHERE status = 'cancelled'",
  );
  if (result.rows.length === 0) {
    return {
      passed: false,
      message: "No cancelled orders found in snapshots.",
      details: { cancelledCount: 0 },
    };
  }
  const allZero = result.rows.every((r: any) => Number(r.total_amount) === 0);
  return {
    passed: allZero,
    message: allZero
      ? `All ${result.rows.length} cancelled orders have zero amount.`
      : "Some cancelled orders have non-zero amounts.",
    details: { cancelledCount: result.rows.length, rows: result.rows },
  };
}
