import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const CANONICAL_QUERY = `
SELECT
  formatDateTime(toStartOfMonth(event_ts), '%Y-%m-01') AS month,
  region,
  arrayJoin(tags) AS tag,
  priority,
  count() AS n,
  avg(value) AS avg_value,
  quantileTDigest(0.5)(value) AS p50,
  quantileTDigest(0.9)(value) AS p90,
  uniqExact(user_id) AS unique_users,
  COUNT() OVER () AS total
FROM analytics.events
WHERE event_ts >= toDateTime('2026-01-01 00:00:00')
  AND event_ts <  toDateTime('2026-07-01 00:00:00')
  AND value IS NOT NULL
  AND event_type != 'deleted'
GROUP BY month, region, tag, priority
ORDER BY month, region, tag, priority
LIMIT 50
`;

const NO_CACHE_SETTINGS = {
  use_query_cache: 0,
  enable_reads_from_query_cache: 0,
  enable_writes_to_query_cache: 0,
} as const;

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({
    query: sql,
    format: "JSONEachRow",
    clickhouse_settings: NO_CACHE_SETTINGS,
  });
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
