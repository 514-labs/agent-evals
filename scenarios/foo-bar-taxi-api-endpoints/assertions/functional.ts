import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function analytics_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.analytics_table_name;
  if (!tableName) {
    return { passed: false, message: "analytics_table_name not set in assertions.json.", details: {} };
  }

  const parts = tableName.includes(".") ? tableName.split(".") : ["default", tableName];
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Analytics table exists." : `Analytics table '${tableName}' not found.`,
    details: { tableName, count },
  };
}

export async function analytics_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.analytics_table_name;
  if (!tableName) {
    return { passed: false, message: "analytics_table_name not set in assertions.json.", details: {} };
  }

  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${tableName}`);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 100000;
  return {
    passed,
    message: passed ? `Analytics table has ${count} rows.` : `Expected >100K rows, got ${count}.`,
    details: { count },
  };
}

export async function all_endpoints_respond_200(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";
  const endpoints = config.endpoints;
  if (!Array.isArray(endpoints) || endpoints.length < 3) {
    return { passed: false, message: "Expected at least 3 endpoints in assertions.json.", details: { endpoints } };
  }

  const results: Array<{ path: string; status: number | string }> = [];
  for (const ep of endpoints) {
    const path = ep.path;
    if (!path) {
      results.push({ path: "(empty)", status: "missing" });
      continue;
    }
    try {
      const res = await fetch(`${baseUrl}${path}`);
      results.push({ path, status: res.status });
    } catch (e) {
      results.push({ path, status: e instanceof Error ? e.message : "error" });
    }
  }

  const okCount = results.filter((r) => r.status === 200).length;
  const passed = okCount >= 3;
  return {
    passed,
    message: passed ? `All ${okCount} endpoints respond HTTP 200.` : `Only ${okCount}/3 endpoints returned 200.`,
    details: { results },
  };
}
