import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function conversion_rate_in_valid_range(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const colRows = await queryRows<{ name: string }>(
      ctx,
      "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'metrics_daily'",
    );
    const convCol = colRows.find((r) => r.name.toLowerCase().includes("conversion"))?.name ?? "conversion_rate";
    const rows = await queryRows<Record<string, number>>(
      ctx,
      `SELECT ${convCol} AS v FROM analytics.metrics_daily WHERE ${convCol} IS NOT NULL LIMIT 1`,
    );
    if (rows.length === 0) {
      return { passed: false, message: "No conversion rate values.", details: {} };
    }
    const rate = Number(Object.values(rows[0] ?? {})[0] ?? -1);
    const passed = rate >= 0 && rate <= 1;
    return {
      passed,
      message: passed ? "Conversion rate in valid range." : `Conversion rate ${rate} out of [0,1].`,
      details: { rate },
    };
  } catch (e) {
    return {
      passed: false,
      message: "Could not check conversion rate.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
