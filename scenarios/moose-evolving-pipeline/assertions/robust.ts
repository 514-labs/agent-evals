import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { fetchEgressJson, findEventsTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function api_handles_missing_limit_param(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEgressJson<any[]>(ctx, "top-products", { paths: ["/api/top-products"] });
  if (!result) {
    return { passed: false, message: "Top products API unreachable.", details: {} };
  }
  const data = result.data;
  const passed = Array.isArray(data) && data.length > 0 && data.length <= 10;
  return {
    passed,
    message: passed
      ? `Top products without limit returns ${data.length} items (default applied).`
      : `Expected 1-10 items without limit param, got ${Array.isArray(data) ? data.length : "non-array"}.`,
    details: { count: Array.isArray(data) ? data.length : 0, url: result.url },
  };
}

export async function api_returns_valid_json(ctx: AssertionContext): Promise<AssertionResult> {
  const endpoints: Array<{ name: string; path: string }> = [
    { name: "top-products", path: "/api/top-products" },
    { name: "revenue-by-region", path: "/api/revenue-by-region" },
  ];
  const failures: string[] = [];

  for (const { name, path } of endpoints) {
    const result = await fetchEgressJson<unknown>(ctx, name, { paths: [path] });
    if (!result) {
      failures.push(`${path}: unreachable`);
      continue;
    }
    if (!Array.isArray(result.data)) {
      failures.push(`${path}: not a JSON array`);
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
