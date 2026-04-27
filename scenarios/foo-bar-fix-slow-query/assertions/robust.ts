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

function normalize(rows: Record<string, unknown>[]): string {
  return rows
    .map(
      (r) =>
        `${String(r.day)}|${String(r.event_count)}|${String(r.unique_users)}`,
    )
    .sort()
    .join(";");
}

export async function canonical_query_stable_across_3_runs(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const keys: string[] = [];
  for (let i = 0; i < 3; i++) {
    const rows = await queryRows<Record<string, unknown>>(ctx, CANONICAL_QUERY);
    keys.push(normalize(rows));
  }
  const passed = keys[0] === keys[1] && keys[1] === keys[2];
  return {
    passed,
    message: passed
      ? "Canonical query returned the same result across 3 runs."
      : "Canonical query result varies between runs — non-deterministic fix.",
    details: { uniqueResults: new Set(keys).size },
  };
}
