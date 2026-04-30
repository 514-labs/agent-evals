import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events_local",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 6000000;
  return {
    passed,
    message: passed ? "All 6000000 rows are preserved." : `Expected 6000000 rows, got ${count}.`,
    details: { count },
  };
}

export async function benchmark_query_repeatable(ctx: AssertionContext): Promise<AssertionResult> {
  const sql = `
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
  const firstRun = await queryRows<Record<string, unknown>>(ctx, sql);
  const secondRun = await queryRows<Record<string, unknown>>(ctx, sql);
  const passed = JSON.stringify(firstRun) === JSON.stringify(secondRun);
  return {
    passed,
    message: passed ? "Benchmark query results are stable across reruns." : "Benchmark query results changed across reruns.",
    details: {
      firstRowCount: firstRun.length,
      secondRowCount: secondRun.length,
    },
  };
}
