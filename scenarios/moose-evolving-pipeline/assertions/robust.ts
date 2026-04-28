import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findEventsTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function fetchJsonAnyPort(paths: string[]): Promise<{ data: any; port: number } | null> {
  for (const port of [3000, 4000, 8080]) {
    for (const p of paths) {
      try {
        const res = await fetch(`http://localhost:${port}${p}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return { data: await res.json(), port };
      } catch {}
    }
  }
  return null;
}

export async function api_handles_missing_limit_param(): Promise<AssertionResult> {
  const result = await fetchJsonAnyPort(["/api/top-products"]);
  if (!result) {
    return { passed: false, message: "Top products API unreachable.", details: {} };
  }
  const passed = Array.isArray(result.data) && result.data.length > 0 && result.data.length <= 10;
  return {
    passed,
    message: passed
      ? `Top products without limit returns ${result.data.length} items (default applied).`
      : `Expected 1-10 items without limit param, got ${Array.isArray(result.data) ? result.data.length : "non-array"}.`,
    details: { count: Array.isArray(result.data) ? result.data.length : 0, port: result.port },
  };
}

export async function api_returns_valid_json(): Promise<AssertionResult> {
  const endpoints = ["/api/top-products", "/api/revenue-by-region"];
  const failures: string[] = [];

  for (const endpoint of endpoints) {
    const result = await fetchJsonAnyPort([endpoint]);
    if (!result) {
      failures.push(`${endpoint}: unreachable`);
      continue;
    }
    if (!Array.isArray(result.data)) {
      failures.push(`${endpoint}: not a JSON array`);
    }
  }

  const passed = failures.length === 0;
  return {
    passed,
    message: passed ? "Both API endpoints return valid JSON arrays." : `Failures: ${failures.join("; ")}.`,
    details: { failures },
  };
}

export async function no_duplicate_events(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const rows = await queryRows<{ total: number; distinct: number }>(
    ctx,
    `SELECT count() AS total, uniqExact(event_id) AS distinct FROM ${found.database}.${found.table}`,
  );
  const total = Number(rows[0]?.total ?? 0);
  const distinct = Number(rows[0]?.distinct ?? 0);
  const passed = total === distinct && total === 100;
  return {
    passed,
    message: passed
      ? "No duplicate events (100 total, 100 distinct)."
      : `Total=${total}, distinct=${distinct} (expected 100 each).`,
    details: { total, distinct },
  };
}
