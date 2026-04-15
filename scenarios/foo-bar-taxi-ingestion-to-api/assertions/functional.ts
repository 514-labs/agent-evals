import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function source_table_exists_with_data(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const sourceTable = meta.source_table;

  if (!sourceTable || typeof sourceTable !== "string" || sourceTable.length === 0) {
    return { passed: false, message: "source_table not defined in assertions.json.", details: {} };
  }

  try {
    const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${sourceTable}`);
    const count = Number(rows[0]?.n ?? 0);
    const passed = count > 0;
    return {
      passed,
      message: passed
        ? `Source table ${sourceTable} exists with ${count} rows.`
        : `Source table ${sourceTable} has 0 rows or does not exist.`,
      details: { sourceTable, rowCount: count },
    };
  } catch (err) {
    return { passed: false, message: `Failed to query source table: ${String(err)}`, details: {} };
  }
}

export async function at_least_2_api_endpoints_respond(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const apiEndpoints = meta.api_endpoints;
  const baseUrl = "http://localhost:3000";

  if (!Array.isArray(apiEndpoints) || apiEndpoints.length === 0) {
    return { passed: false, message: "api_endpoints not defined or empty in assertions.json.", details: {} };
  }

  const results: Array<{ path: string; status: number }> = [];
  for (const endpoint of apiEndpoints) {
    try {
      const resp = await fetch(`${baseUrl}${endpoint}`);
      results.push({ path: endpoint, status: resp.status });
    } catch {
      results.push({ path: endpoint, status: 0 });
    }
  }

  const okCount = results.filter((r) => r.status === 200).length;
  const passed = okCount >= 2;
  return {
    passed,
    message: passed
      ? `${okCount} API endpoints responded with HTTP 200.`
      : `Only ${okCount} API endpoints responded with HTTP 200 (need at least 2).`,
    details: { results },
  };
}
