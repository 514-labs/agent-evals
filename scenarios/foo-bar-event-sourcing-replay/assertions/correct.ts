import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

// Seed events (from init/seed-events.py):
//   ord_001 created 29.99, then updated to 20.00 → active, total = 20.00
//   ord_002 created 59.50, then cancelled → cancelled, total = 0
//   ord_003 created 14.25 → active, total = 14.25
//   ord_004 created 99.00 → active, total = 99.00
// Expected active sum: 20.00 + 14.25 + 99.00 = 133.25

export async function total_amount_matches_events(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT coalesce(sum(total_amount), 0) AS s FROM app.order_snapshots WHERE status = 'active'",
  );
  const snapshotSum = Number(result.rows[0]?.s ?? 0);
  const expectedSum = 133.25; // 20.00 + 14.25 + 99.00
  const passed = Math.abs(snapshotSum - expectedSum) < 0.01;
  return {
    passed,
    message: passed
      ? "Total amount matches replayed events."
      : `Expected ~${expectedSum}, got ${snapshotSum}.`,
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

export async function all_four_orders_present(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT count(DISTINCT order_id) AS n FROM app.order_snapshots",
  );
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 4;
  return {
    passed,
    message: passed ? "All 4 orders present in snapshots." : `Expected 4 distinct orders, got ${count}.`,
    details: { count },
  };
}
