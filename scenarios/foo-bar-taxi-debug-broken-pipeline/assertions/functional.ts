import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function process_starts_clean(ctx: AssertionContext): Promise<AssertionResult> {
  // Check that the TypeScript project compiles without errors
  const { execSync } = await import("node:child_process");

  try {
    execSync("npx tsc --noEmit", { cwd: "/workspace", timeout: 30000, stdio: "pipe" });
    return {
      passed: true,
      message: "TypeScript project compiles without errors.",
      details: {},
    };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    return {
      passed: false,
      message: "TypeScript project has compilation errors.",
      details: { stderr, stdout },
    };
  }
}

export async function analytics_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const rows = await queryRows<{ n: number }>(
      ctx,
      `SELECT count() AS n FROM analytics.taxi_trips`,
    );
    const count = Number(rows[0]?.n ?? 0);
    const passed = count > 0;
    return {
      passed,
      message: passed
        ? `analytics.taxi_trips has ${count} rows.`
        : "analytics.taxi_trips has 0 rows or does not exist.",
      details: { count },
    };
  } catch (err) {
    return {
      passed: false,
      message: `Failed to query analytics.taxi_trips: ${String(err)}`,
      details: {},
    };
  }
}
