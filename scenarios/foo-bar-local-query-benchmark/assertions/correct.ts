import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const Q1_SQL = `
SELECT
  toDate(event_ts) AS day,
  count() AS events,
  sum(bytes) AS total_bytes
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_date >= toDate('2026-02-01')
  AND event_date < toDate('2026-03-01')
GROUP BY day
ORDER BY day
`;

const Q2_SQL = `
SELECT
  event_type,
  uniqExact(account_id) AS active_accounts,
  quantileExact(0.95)(duration_ms) AS p95_duration
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_date >= toDate('2026-02-01')
  AND event_date < toDate('2026-03-01')
GROUP BY event_type
ORDER BY event_type
`;

const Q3_SQL = `
SELECT
  toStartOfHour(event_ts) AS hour,
  count() AS events
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_ts >= toDateTime('2026-02-10 00:00:00')
  AND event_ts < toDateTime('2026-02-12 00:00:00')
GROUP BY hour
ORDER BY hour
`;

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function compareToExpected(
  ctx: AssertionContext,
  actualSql: string,
  expectedSql: string,
): Promise<{ passed: boolean; actualCount: number; expectedCount: number }> {
  const actualRows = await queryRows<Record<string, unknown>>(ctx, actualSql);
  const expectedRows = await queryRows<Record<string, unknown>>(ctx, expectedSql);
  return {
    passed: JSON.stringify(actualRows) === JSON.stringify(expectedRows),
    actualCount: actualRows.length,
    expectedCount: expectedRows.length,
  };
}

export async function q1_matches_reference(ctx: AssertionContext): Promise<AssertionResult> {
  const comparison = await compareToExpected(
    ctx,
    Q1_SQL,
    "SELECT * FROM analytics.expected_q1 ORDER BY day",
  );
  return {
    passed: comparison.passed,
    message: comparison.passed ? "q1 matches the seeded reference output." : "q1 output changed.",
    details: comparison,
  };
}

export async function q2_matches_reference(ctx: AssertionContext): Promise<AssertionResult> {
  const comparison = await compareToExpected(
    ctx,
    Q2_SQL,
    "SELECT * FROM analytics.expected_q2 ORDER BY event_type",
  );
  return {
    passed: comparison.passed,
    message: comparison.passed ? "q2 matches the seeded reference output." : "q2 output changed.",
    details: comparison,
  };
}

export async function q3_matches_reference(ctx: AssertionContext): Promise<AssertionResult> {
  const comparison = await compareToExpected(
    ctx,
    Q3_SQL,
    "SELECT * FROM analytics.expected_q3 ORDER BY hour",
  );
  return {
    passed: comparison.passed,
    message: comparison.passed ? "q3 matches the seeded reference output." : "q3 output changed.",
    details: comparison,
  };
}
