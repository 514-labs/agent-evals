import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function events_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'product_events'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Events table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}

export async function events_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.product_events",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? "Events table has rows." : "Events table is empty.",
    details: { count },
  };
}

export async function api_server_responds(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const response = await fetch("http://localhost:3000/api/top-products");
    const passed = response.ok;
    return {
      passed,
      message: passed ? "API server responds." : `API returned status ${response.status}.`,
      details: { status: response.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API server did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
