import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { fetchEgressJson } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function total_value_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ s: number }>(ctx, "SELECT sum(value) AS s FROM analytics.events");
  const expected = Number(rows[0]?.s ?? 0);

  const result = await fetchEgressJson<any>(ctx, "metrics", { paths: ["/api/metrics"] });
  const data = result?.data;
  if (data === undefined) {
    return {
      passed: false,
      message: "API did not return JSON.",
      details: { url: result?.url, expected },
    };
  }
  const actual = Number(data?.total_value ?? data?.totalValue ?? data?.sum ?? 0);
  const passed = Math.abs(expected - actual) < 0.01;
  return {
    passed,
    message: passed ? "Total value matches source." : `Expected ${expected}, got ${actual}.`,
    details: { url: result?.url, expected, actual },
  };
}
