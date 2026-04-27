import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const CANONICAL_QUERY = `
SELECT
  toDate(event_ts) AS day,
  count() AS event_count,
  uniqExact(user_id) AS unique_users
FROM analytics.events
WHERE region = 'us-east'
  AND event_ts >= toDateTime('2026-02-01 00:00:00')
  AND event_ts <  toDateTime('2026-02-08 00:00:00')
GROUP BY day
ORDER BY day
`;

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function events_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed
      ? "analytics.events table is present."
      : "analytics.events was dropped — source data lost.",
    details: { expected: 1, actual: count },
  };
}

export async function canonical_query_executes(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const rows = await queryRows<Record<string, unknown>>(ctx, CANONICAL_QUERY);
    return {
      passed: true,
      message: `Canonical query executed and returned ${rows.length} rows.`,
      details: { rows: rows.length },
    };
  } catch (err) {
    return {
      passed: false,
      message: `Canonical query failed: ${(err as Error).message}`,
      details: { error: (err as Error).message },
    };
  }
}
