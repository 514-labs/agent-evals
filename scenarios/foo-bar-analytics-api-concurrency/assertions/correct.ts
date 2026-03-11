import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function metrics_total_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await ctx.clickhouse.query({
    query: "SELECT sum(value) AS s FROM analytics.metrics",
    format: "JSONEachRow",
  });
  const data = (await (rows as any).json()) as { s: number }[];
  const expectedTotal = Number(data[0]?.s ?? 0);

  const apiData = await fetchJson("http://localhost:3000/api/metrics");
  const actualTotal = Number(apiData?.total ?? apiData?.sum ?? 0);
  const passed = Math.abs(expectedTotal - actualTotal) < 0.01;
  return {
    passed,
    message: passed ? "Metrics total matches source." : `Expected ${expectedTotal}, got ${actualTotal}.`,
    details: { expectedTotal, actualTotal },
  };
}
