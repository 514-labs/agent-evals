import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function total_value_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ s: number }>(ctx, "SELECT sum(value) AS s FROM analytics.events");
  const expected = Number(rows[0]?.s ?? 0);

  const data = await fetchJson("http://localhost:3000/api/metrics");
  const actual = Number(data?.total_value ?? data?.totalValue ?? data?.sum ?? 0);
  const passed = Math.abs(expected - actual) < 0.01;
  return {
    passed,
    message: passed ? "Total value matches source." : `Expected ${expected}, got ${actual}.`,
    details: { expected, actual },
  };
}
