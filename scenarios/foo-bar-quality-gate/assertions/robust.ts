import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function no_false_positives_on_clean_data(ctx: AssertionContext): Promise<AssertionResult> {
  const cleanCheck = await ctx.pg.query(`
    SELECT count(DISTINCT event_id) AS n FROM raw.events
    WHERE event_id LIKE 'evt_%'
      AND event_id NOT LIKE 'evt_drift_%'
      AND event_id NOT LIKE 'evt_stale_%'
      AND event_ts >= '2025-01-01'
  `);
  const cleanCount = Number(cleanCheck.rows[0]?.n ?? 0);
  const passed = cleanCount === 50;
  return {
    passed,
    message: passed ? "No false positives on clean data." : `Expected 50 clean events, got ${cleanCount}.`,
    details: { cleanCount },
  };
}
