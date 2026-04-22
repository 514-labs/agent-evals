import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries } from "../../_shared/assertion-helpers";

async function queryRows<T>(
  ctx: AssertionContext,
  sql: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow", query_params });
  return (await (result as any).json()) as T[];
}

function eventsDb(ctx: AssertionContext): string {
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

// With the target ORDER BY (event_type, event_ts, event_id), filtering by
// (event_type, event_ts) hits the primary-key index. With the old ORDER BY
// (event_ts, event_id), the same filter scans far more rows. Thresholded
// at 100ms — at 10k rows, the index path is typically <5ms and a full
// scan path is 30–80ms depending on load, so 100ms discriminates reliably.
export async function point_lookup_uses_primary_key_index(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const spot = await queryRows<{ event_type: string; event_ts: string }>(
    ctx,
    `SELECT event_type, toString(event_ts) AS event_ts FROM \`${db}\`._seed_spotchecks LIMIT 1`,
  );
  if (spot.length === 0) {
    return { passed: false, message: `${db}._seed_spotchecks is empty.`, details: {} };
  }
  const { event_type, event_ts } = spot[0];
  const thresholdMs = 100;
  const start = Date.now();
  await ctx.clickhouse.query({
    query:
      `SELECT event_id FROM \`${db}\`.events ` +
      `WHERE event_type = {et:String} AND event_ts = parseDateTimeBestEffort({ts:String})`,
    format: "JSONEachRow",
    query_params: { et: event_type, ts: event_ts },
  });
  const elapsed = Date.now() - start;
  const passed = elapsed <= thresholdMs;
  return {
    passed,
    message: passed
      ? `Point lookup by (event_type, event_ts) ran in ${elapsed}ms (<= ${thresholdMs}ms).`
      : `Point lookup took ${elapsed}ms (> ${thresholdMs}ms) — ORDER BY likely does not start with event_type.`,
    details: { elapsedMs: elapsed, thresholdMs, probedType: event_type, probedTs: event_ts },
  };
}

export async function filter_by_event_type_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT event_id FROM \`${db}\`.events WHERE event_type = 'purchase'`,
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
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
