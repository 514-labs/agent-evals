import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function metrics_match_source(ctx: AssertionContext): Promise<AssertionResult> {
  const sourceRows = await queryRows<{ total: number; users: number; revenue: number }>(
    ctx,
    "SELECT count() AS total, uniq(user_id) AS users, sum(revenue) AS revenue FROM analytics.events",
  );
  const src = sourceRows[0];
  const apiRes = await fetch("http://localhost:3000/api/metrics");
  if (!apiRes.ok) {
    return { passed: false, message: "API metrics failed.", details: { status: apiRes.status } };
  }
  const data = (await apiRes.json()) as { total_events?: number; unique_users?: number; total_revenue?: number };
  const apiTotal = Number(data.total_events ?? data.total ?? 0);
  const apiUsers = Number(data.unique_users ?? data.users ?? 0);
  const apiRevenue = Number(data.total_revenue ?? data.revenue ?? 0);
  const totalMatch = Math.abs(apiTotal - Number(src?.total ?? 0)) < 10;
  const usersMatch = Math.abs(apiUsers - Number(src?.users ?? 0)) < 10;
  const revenueMatch = Math.abs(apiRevenue - Number(src?.revenue ?? 0)) < 100;
  const passed = totalMatch && usersMatch && revenueMatch;
  return {
    passed,
    message: passed ? "Metrics match source." : "API metrics do not match source aggregates.",
    details: { apiTotal, apiUsers, apiRevenue, srcTotal: src?.total, srcUsers: src?.users, srcRevenue: src?.revenue },
  };
}
