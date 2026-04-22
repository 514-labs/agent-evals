import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries } from "../../_shared/assertion-helpers";

function eventsDb(ctx: AssertionContext): string {
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

export async function filter_by_event_type_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT event_id, event_ts FROM \`${db}\`.events WHERE event_type = 'purchase'`,
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  // 500ms is deliberately loose — with only 8 rows, the point is to catch
  // a regression where the agent created a non-MergeTree table or broke
  // query planning, not to measure true ORDER BY benefit.
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? `Event-type filter ran in ${elapsed}ms.` : `Event-type filter took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_in_workspace(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
