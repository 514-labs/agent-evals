import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function aggregation_query_returns_data(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ host_id: string; metric_name: string }>(
    ctx,
    "SELECT host_id, metric_name, avg(value) AS avg_val, count() AS cnt FROM analytics.realtime_metrics GROUP BY host_id, metric_name",
  );
  const passed = rows.length >= 4;
  return {
    passed,
    message: passed ? `Aggregation returned ${rows.length} groups.` : `Expected >=4 groups, got ${rows.length}.`,
    details: { groupCount: rows.length },
  };
}

export async function value_checksum_matches_seed(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(value) AS s FROM analytics.realtime_metrics",
  );
  const sum = Number(rows[0]?.s ?? 0);
  const expectedSum = 45 + 52 + 68 + 78 + 55 + 81 + 23 + 72 + 70 + 25;
  const passed = Math.abs(sum - expectedSum) < 0.01;
  return {
    passed,
    message: passed ? "Value checksum matches seed." : `Expected ~${expectedSum}, got ${sum}.`,
    details: { sum, expectedSum },
  };
}
