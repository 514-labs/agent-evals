import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(
  ctx: AssertionContext,
  sql: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow", query_params });
  return (await (result as any).json()) as T[];
}

export async function final_query_completes_quickly(ctx: AssertionContext): Promise<AssertionResult> {
  const thresholdMs = 1000;
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.events FINAL",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed <= thresholdMs;
  return {
    passed,
    message: passed
      ? `FINAL count() completed in ${elapsed}ms (<= ${thresholdMs}ms).`
      : `FINAL count() took ${elapsed}ms (> ${thresholdMs}ms).`,
    details: { elapsedMs: elapsed, thresholdMs },
  };
}

// With ORDER BY (user_id, event_id), a point lookup by both keys should use the
// primary-key index and not scan the full table.
export async function point_query_uses_primary_key_index(ctx: AssertionContext): Promise<AssertionResult> {
  const spot = await queryRows<{ user_id: string; event_id: string }>(
    ctx,
    "SELECT user_id, event_id FROM analytics._seed_spotchecks LIMIT 1",
  );
  if (spot.length === 0) {
    return { passed: false, message: "Spotcheck anchor table is empty.", details: {} };
  }
  const { user_id, event_id } = spot[0];
  const thresholdMs = 200;
  const start = Date.now();
  await ctx.clickhouse.query({
    query:
      "SELECT value FROM analytics.events FINAL " +
      "WHERE user_id = {user_id:String} AND event_id = {event_id:String}",
    format: "JSONEachRow",
    query_params: { user_id, event_id },
  });
  const elapsed = Date.now() - start;
  const passed = elapsed <= thresholdMs;
  return {
    passed,
    message: passed
      ? `Point lookup by (user_id, event_id) completed in ${elapsed}ms (<= ${thresholdMs}ms).`
      : `Point lookup took ${elapsed}ms (> ${thresholdMs}ms) — likely full-table scan, ORDER BY may be wrong.`,
    details: { elapsedMs: elapsed, thresholdMs },
  };
}
