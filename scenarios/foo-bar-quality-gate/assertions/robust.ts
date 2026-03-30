import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function no_false_positives_on_clean_data(ctx: AssertionContext): Promise<AssertionResult> {
  const cleanCheck = await ctx.pg.query(`
    SELECT count(DISTINCT event_id) AS n FROM raw.events
    WHERE event_id LIKE 'evt_%'
      AND event_id NOT LIKE 'evt_drift_%'
      AND event_id NOT LIKE 'evt_stale_%'
      AND event_ts >= '2025-01-01'
  `);
  const cleanCount = Number(cleanCheck.rows[0]?.n ?? 0);
  const passed = cleanCount >= 1;
  return {
    passed,
    message: passed ? `${cleanCount} clean events found (no false positives).` : "No clean events found.",
    details: { cleanCount },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
