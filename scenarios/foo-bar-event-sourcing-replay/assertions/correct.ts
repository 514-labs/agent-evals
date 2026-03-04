import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function total_amount_matches_events(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT coalesce(sum(total_amount), 0) AS s FROM app.order_snapshots WHERE status = 'active'",
  );
  const snapshotSum = Number(result.rows[0]?.s ?? 0);
  const expectedSum = 20.0 + 14.25 + 99.0;
  const passed = Math.abs(snapshotSum - expectedSum) < 0.01;
  return {
    passed,
    message: passed ? "Total amount matches replayed events." : `Expected ~${expectedSum}, got ${snapshotSum}.`,
    details: { snapshotSum, expectedSum },
  };
}

export async function cancelled_order_has_zero_amount(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT total_amount FROM app.order_snapshots WHERE order_id = 'ord_002' AND status = 'cancelled'",
  );
  const passed = result.rows.length === 1 && Number(result.rows[0]?.total_amount ?? -1) === 0;
  return {
    passed,
    message: passed ? "Cancelled order has zero amount." : "ord_002 should be cancelled with amount 0.",
    details: { rows: result.rows.length },
  };
}
