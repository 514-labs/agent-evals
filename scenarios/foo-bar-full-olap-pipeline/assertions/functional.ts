import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findProductEventsTable, probeEgress, probeIngest } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function clickhouse_has_events_table(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findProductEventsTable(ctx);
  const passed = found !== null;
  return {
    passed,
    message: passed
      ? `Events table exists at ${found!.database}.${found!.table}.`
      : "No product events table found in ClickHouse.",
    details: { found },
  };
}

export async function events_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findProductEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? `Table has ${count} rows.` : "Table is empty.",
    details: { count, location: `${found.database}.${found.table}` },
  };
}

export async function api_server_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "top-products", {
    paths: ["/api/top-products", "/api/topProducts", "/top-products"],
  });
  if (result) {
    return {
      passed: true,
      message: `API server responded at ${result.url} (status ${result.response.status}).`,
      details: { url: result.url, status: result.response.status },
    };
  }
  return {
    passed: false,
    message: "API server did not respond via EGRESS_URL_TOP_PRODUCTS or fallback ports.",
    details: {},
  };
}

export async function http_ingest_endpoint_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const body = JSON.stringify({
    event_id: "probe_event",
    event_ts: "2026-01-15T16:00:00Z",
    user_id: "probe_user",
    product_id: "probe_product",
    event_type: "view",
    properties: {},
  });
  const result = await probeIngest(ctx, {
    paths: ["/ingest/events", "/ingest/ProductEvent", "/ingest", "/events"],
    body,
    timeoutMs: 2000,
  });
  if (result) {
    return {
      passed: true,
      message: `Ingest endpoint responded at ${result.url} (status ${result.response.status}).`,
      details: { url: result.url, status: result.response.status },
    };
  }
  return {
    passed: false,
    message: "No HTTP ingest endpoint responded via INGEST_URL or fallback ports.",
    details: {},
  };
}
