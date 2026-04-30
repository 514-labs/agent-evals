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

async function measureQueryMs(ctx: AssertionContext, sql: string): Promise<number> {
  await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  const start = Date.now();
  await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return Date.now() - start;
}

export async function q1_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const elapsedMs = await measureQueryMs(ctx, Q1_SQL);
  const passed = elapsedMs < 200;
  return {
    passed,
    message: passed ? "q1 runs under 200ms after warm-up." : `q1 took ${elapsedMs}ms.`,
    details: { elapsedMs, thresholdMs: 200 },
  };
}

export async function q2_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const elapsedMs = await measureQueryMs(ctx, Q2_SQL);
  const passed = elapsedMs < 200;
  return {
    passed,
    message: passed ? "q2 runs under 200ms after warm-up." : `q2 took ${elapsedMs}ms.`,
    details: { elapsedMs, thresholdMs: 200 },
  };
}

export async function q3_under_150ms(ctx: AssertionContext): Promise<AssertionResult> {
  const elapsedMs = await measureQueryMs(ctx, Q3_SQL);
  const passed = elapsedMs < 150;
  return {
    passed,
    message: passed ? "q3 runs under 150ms after warm-up." : `q3 took ${elapsedMs}ms.`,
    details: { elapsedMs, thresholdMs: 150 },
  };
}
