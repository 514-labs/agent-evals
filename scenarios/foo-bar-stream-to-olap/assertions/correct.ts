import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function value_checksum_matches_seed(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(value) AS s FROM analytics.metrics",
  );
  const sum = Number(rows[0]?.s ?? 0);
  const expectedSum = 45.2 + 62.1 + 78.5 + 55.0 + 23.0 + 120.5 + 48.0 + 81.2 + 70.3 + 65.0;
  const passed = Math.abs(sum - expectedSum) < 0.01;
  return {
    passed,
    message: passed ? "Value checksum matches seed." : `Expected ~${expectedSum}, got ${sum}.`,
    details: { sum, expectedSum },
  };
}

export async function host_and_metric_columns_present(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'metrics'",
  );
  const names = rows.map((r) => r.name);
  const hasHost = names.includes("host_id");
  const hasMetric = names.includes("metric_name");
  const hasValue = names.includes("value");
  const passed = hasHost && hasMetric && hasValue;
  return {
    passed,
    message: passed ? "Required columns present." : `Missing columns. Got: ${names.join(", ")}.`,
    details: { names, hasHost, hasMetric, hasValue },
  };
}
