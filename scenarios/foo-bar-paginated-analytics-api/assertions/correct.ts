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

export async function total_matches_source_count(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const expectedTotal = Number(rows[0]?.n ?? 0);

  const apiData = await fetchJson("http://localhost:3000/api/events?limit=1&offset=0");
  const actualTotal = Number(apiData?.total ?? apiData?.totalCount ?? -1);
  const passed = actualTotal === expectedTotal;
  return {
    passed,
    message: passed ? "Total matches source count." : `Expected total ${expectedTotal}, got ${actualTotal}.`,
    details: { expectedTotal, actualTotal },
  };
}

export async function limit_respected(ctx: AssertionContext): Promise<AssertionResult> {
  const data = await fetchJson("http://localhost:3000/api/events?limit=7&offset=0");
  const arr = data?.data ?? data?.events ?? [];
  const passed = arr.length <= 7;
  return {
    passed,
    message: passed ? "Limit respected." : `Expected at most 7 rows, got ${arr.length}.`,
    details: { returnedCount: arr.length },
  };
}
