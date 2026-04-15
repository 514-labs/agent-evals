import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function analytics_table_exists_with_rows(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch (err) {
    return { passed: false, message: "Could not read /workspace/assertions.json.", details: { error: String(err) } };
  }
  const table = meta.analytics_table_name;
  if (!table || typeof table !== "string") {
    return { passed: false, message: "analytics_table_name not set in assertions.json.", details: {} };
  }
  // The table name may be fully qualified (db.table) or just a table name
  const parts = table.split(".");
  let sql: string;
  if (parts.length === 2) {
    sql = `SELECT count() AS n FROM ${parts[0]}.${parts[1]}`;
  } else {
    sql = `SELECT count() AS n FROM ${table}`;
  }
  const rows = await queryRows<{ n: number }>(ctx, sql);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 3_000_000;
  return {
    passed,
    message: passed
      ? `Analytics table has ${count} rows (> 3M).`
      : `Analytics table has ${count} rows, expected > 3M.`,
    details: { table, count },
  };
}

export async function api_endpoints_respond_200(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch (err) {
    return { passed: false, message: "Could not read /workspace/assertions.json.", details: { error: String(err) } };
  }
  const baseUrl = meta.api_base_url;
  const endpoints: string[] = meta.endpoints;
  if (!baseUrl || !Array.isArray(endpoints) || endpoints.length === 0) {
    return {
      passed: false,
      message: "api_base_url or endpoints not set in assertions.json.",
      details: { baseUrl, endpoints },
    };
  }

  const results: Array<{ endpoint: string; status: number | string }> = [];
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const resp = await fetch(url);
      results.push({ endpoint, status: resp.status });
    } catch (err) {
      results.push({ endpoint, status: String(err) });
    }
  }

  const okCount = results.filter((r) => r.status === 200).length;
  const passed = okCount >= 3;
  return {
    passed,
    message: passed
      ? `${okCount} of ${results.length} endpoints returned HTTP 200 (>= 3 required).`
      : `Only ${okCount} of ${results.length} endpoints returned HTTP 200 (>= 3 required).`,
    details: { results },
  };
}
