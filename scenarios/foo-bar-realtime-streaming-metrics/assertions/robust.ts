import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function handles_multiple_hosts(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT uniq(host_id) AS n FROM analytics.realtime_metrics",
  );
  const uniqHosts = Number(rows[0]?.n ?? 0);
  const passed = uniqHosts >= 3;
  return {
    passed,
    message: passed ? `Multiple hosts present (${uniqHosts}).` : `Expected >=3 hosts, got ${uniqHosts}.`,
    details: { uniqHosts },
  };
}
