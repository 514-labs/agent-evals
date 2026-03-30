import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function total_row_count_unchanged(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events_log");
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 10000000;
  return {
    passed,
    message: passed ? "Total row count unchanged." : `Expected 10000000, got ${count}.`,
    details: { count },
  };
}

export async function purchase_query_uses_prewhere_or_index(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ explain: string }>(
    ctx,
    "EXPLAIN indexes=1 SELECT toDate(event_ts) AS day, count() AS events FROM analytics.events_log WHERE event_type = 'purchase' GROUP BY day ORDER BY day",
  );
  const plan = rows.map((r) => r.explain ?? JSON.stringify(r)).join("\n").toLowerCase();
  const usesIndex = plan.includes("index") || plan.includes("prewhere") || plan.includes("minmax") || plan.includes("granule");
  const fullScan = plan.includes("parts: 1/1") && !usesIndex;
  const passed = usesIndex || !fullScan;
  return {
    passed,
    message: passed
      ? "Purchase query uses indexing or prewhere optimization."
      : "Purchase query appears to do a full scan with no optimization.",
    details: { usesIndex, fullScan, planPreview: plan.slice(0, 500) },
  };
}
