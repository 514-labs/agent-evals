import { existsSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function events_local_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'events_local'",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "events_local table exists." : `Expected 1 events_local table, got ${count}.`,
    details: { count },
  };
}

export async function benchmark_assets_seeded(): Promise<AssertionResult> {
  const requiredPaths = [
    "/workspace/benchmarks/README.md",
    "/workspace/benchmarks/q1.sql",
    "/workspace/benchmarks/q2.sql",
    "/workspace/benchmarks/q3.sql",
    "/workspace/benchmarks/run.sh",
  ];
  const missingPaths = requiredPaths.filter((path) => !existsSync(path));
  return {
    passed: missingPaths.length === 0,
    message:
      missingPaths.length === 0
        ? "Local benchmark assets are present in /workspace/benchmarks."
        : "Missing local benchmark assets.",
    details: { missingPaths },
  };
}
