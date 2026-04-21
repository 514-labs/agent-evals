import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(
  ctx: AssertionContext,
  sql: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow", query_params });
  return (await (result as any).json()) as T[];
}

export async function handles_new_duplicates(ctx: AssertionContext): Promise<AssertionResult> {
  // Pick an existing duplicated key from _seed_spotchecks, insert a NEWER row with
  // a distinctive value, verify FINAL returns the new value. Sentinel is outside
  // the seed range ([0, 2000]) so accidental equality is impossible.
  const spot = await queryRows<{ user_id: string; event_id: string }>(
    ctx,
    "SELECT user_id, event_id FROM analytics._seed_spotchecks LIMIT 1",
  );
  if (spot.length === 0) {
    return {
      passed: false,
      message: "No spotcheck rows available to test new-duplicate handling.",
      details: {},
    };
  }
  const { user_id, event_id } = spot[0];
  const sentinel = 1_000_000_000.5;
  await ctx.clickhouse.command({
    query:
      "INSERT INTO analytics.events (event_id, user_id, event_type, value, updated_at) " +
      "VALUES ({event_id:String}, {user_id:String}, 'robust_test', {sentinel:Float64}, now64(3))",
    query_params: { event_id, user_id, sentinel },
  });
  const rows = await queryRows<{ value: number }>(
    ctx,
    "SELECT value FROM analytics.events FINAL WHERE user_id = {user_id:String} AND event_id = {event_id:String}",
    { user_id, event_id },
  );
  const actual = Number(rows[0]?.value ?? 0);
  const passed = Math.abs(actual - sentinel) < 1e-6;
  return {
    passed,
    message: passed
      ? "FINAL returns the newly-inserted duplicate row."
      : `FINAL returned ${actual}, expected ${sentinel}.`,
    details: { expected: sentinel, actual },
  };
}
