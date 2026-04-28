import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { fetchEgressJson } from "../../_shared/assertion-helpers";

export async function metrics_total_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await ctx.clickhouse.query({
    query: "SELECT sum(value) AS s FROM analytics.metrics",
    format: "JSONEachRow",
  });
  const data = (await (rows as any).json()) as { s: number }[];
  const expectedTotal = Number(data[0]?.s ?? 0);

  const result = await fetchEgressJson<any>(ctx, "metrics", { paths: ["/api/metrics"] });
  const apiData = result?.data;
  if (apiData === undefined) {
    return {
      passed: false,
      message: "API did not return JSON.",
      details: { url: result?.url, expectedTotal },
    };
  }
  const actualTotal = Number(apiData?.total ?? apiData?.sum ?? 0);
  const passed = Math.abs(expectedTotal - actualTotal) < 0.01;
  return {
    passed,
    message: passed ? "Metrics total matches source." : `Expected ${expectedTotal}, got ${actualTotal}.`,
    details: { url: result?.url, expectedTotal, actualTotal },
  };
}
