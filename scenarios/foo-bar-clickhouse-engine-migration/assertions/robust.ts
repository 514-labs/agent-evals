import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function handles_new_duplicates(ctx: AssertionContext): Promise<AssertionResult> {
  // Pick an existing duplicated key from _seed_spotchecks, insert a NEWER row with
  // a distinctive value, and verify FINAL returns the new value. Uses a value
  // outside the seed range (1e9) to avoid accidental equality.
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
  await ctx.clickhouse.query({
    query: `INSERT INTO analytics.events (event_id, user_id, event_type, value, updated_at) VALUES ('${event_id}', '${user_id}', 'robust_test', ${sentinel}, now64(3))`,
    format: "JSONEachRow",
  });
  const rows = await queryRows<{ value: number }>(
    ctx,
    `SELECT value FROM analytics.events FINAL WHERE user_id = '${user_id}' AND event_id = '${event_id}'`,
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

export async function no_dangling_temp_tables(ctx: AssertionContext): Promise<AssertionResult> {
  const allowed = new Set(["events", "_seed_meta", "_seed_spotchecks"]);
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.tables WHERE database = 'analytics'",
  );
  const unexpected = rows.map((r) => r.name).filter((name) => !allowed.has(name));
  const passed = unexpected.length === 0;
  return {
    passed,
    message: passed
      ? "No leftover temporary tables in analytics."
      : `Found unexpected tables: ${unexpected.join(", ")}.`,
    details: { unexpected, allowed: Array.from(allowed) },
  };
}
