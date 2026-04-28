import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

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

// With target ORDER BY (session_id, event_ts, event_id) a filter on
// session_id alone hits the primary-key prefix. With the original ORDER
// BY (event_ts, event_id) the same filter is a full scan. 150ms at 10k
// rows comfortably discriminates the index path (<5ms) from a scan
// (30–80ms) while leaving headroom for TB proxy overhead.
export async function point_lookup_by_session_id_uses_index(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const spot = await queryRows<{ expected_session_id: string }>(
    ctx,
    `SELECT expected_session_id FROM \`${db}\`._seed_spotchecks LIMIT 1`,
  );
  if (spot.length === 0) {
    return { passed: false, message: `${db}._seed_spotchecks is empty.`, details: {} };
  }
  const { expected_session_id } = spot[0];
  const thresholdMs = 150;
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT event_id FROM \`${db}\`.events WHERE session_id = {sid:String}`,
    format: "JSONEachRow",
    query_params: { sid: expected_session_id },
  });
  const elapsed = Date.now() - start;
  const passed = elapsed <= thresholdMs;
  return {
    passed,
    message: passed
      ? `Point lookup by session_id ran in ${elapsed}ms (<= ${thresholdMs}ms).`
      : `Point lookup took ${elapsed}ms (> ${thresholdMs}ms) — ORDER BY likely does not start with session_id.`,
    details: { elapsedMs: elapsed, thresholdMs, probedSession: expected_session_id },
  };
}

export async function session_id_filter_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const spot = await queryRows<{ expected_session_id: string }>(
    ctx,
    `SELECT expected_session_id FROM \`${db}\`._seed_spotchecks LIMIT 1`,
  );
  if (spot.length === 0) {
    return { passed: false, message: `${db}._seed_spotchecks is empty.`, details: {} };
  }
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT event_id, event_ts FROM \`${db}\`.events WHERE session_id = {sid:String} ORDER BY event_ts`,
    format: "JSONEachRow",
    query_params: { sid: spot[0].expected_session_id },
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? `session_id filter ran in ${elapsed}ms.` : `session_id filter took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
