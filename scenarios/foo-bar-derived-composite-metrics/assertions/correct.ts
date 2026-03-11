import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function metrics_daily_has_derived_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'metrics_daily'",
  );
  const names = rows.map((r) => r.name.toLowerCase());
  const hasConversion = names.some((n) => n.includes("conversion"));
  const hasAov = names.some((n) => n.includes("avg") || n.includes("aov") || n.includes("order_value"));
  const hasDau = names.some((n) => n.includes("dau") || n.includes("active") || n.includes("users"));
  const passed = hasConversion && (hasAov || names.some((n) => n.includes("amount"))) && hasDau;
  return {
    passed,
    message: passed ? "Metrics daily has derived columns." : `Missing columns. Got: ${JSON.stringify(names)}.`,
    details: { names, hasConversion, hasAov, hasDau },
  };
}

export async function metrics_daily_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.metrics_daily",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Metrics daily has rows." : "Metrics daily is empty.",
    details: { count },
  };
}
