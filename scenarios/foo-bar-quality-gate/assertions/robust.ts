import type { AssertionContext } from "@dec-bench/eval-core";

export async function no_false_positives_on_clean_data(ctx: AssertionContext): Promise<boolean> {
  // The 50 clean rows (evt_001 through evt_050) should not be flagged
  // as having quality issues (excluding duplicates injected by chaos script).
  // Check that the clean subset has exactly 50 distinct valid events.
  const cleanCheck = await ctx.pg.query(`
    SELECT count(DISTINCT event_id) AS n FROM raw.events
    WHERE event_id LIKE 'evt_%'
      AND event_id NOT LIKE 'evt_drift_%'
      AND event_id NOT LIKE 'evt_stale_%'
      AND event_ts >= '2025-01-01'
  `);
  const cleanCount = Number(cleanCheck.rows[0]?.n ?? 0);
  return cleanCount === 50;
}
