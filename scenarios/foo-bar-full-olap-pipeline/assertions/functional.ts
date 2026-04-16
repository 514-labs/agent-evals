import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findProductEventsTable } from "../../_shared/assertion-helpers";

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

export async function api_server_responds(): Promise<AssertionResult> {
  for (const port of [3000, 4000, 8080]) {
    try {
      const response = await fetch(`http://localhost:${port}/api/top-products`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok || response.status < 500) {
        return {
          passed: true,
          message: `API server responded on port ${port}.`,
          details: { port, status: response.status },
        };
      }
    } catch {
      // Try next port
    }
  }
  return {
    passed: false,
    message: "API server did not respond on ports 3000, 4000, or 8080.",
    details: {},
  };
}

export async function http_ingest_endpoint_exists(): Promise<AssertionResult> {
  const paths = ["/ingest/events", "/ingest/ProductEvent", "/ingest", "/events"];
  for (const port of [3000, 4000, 8080]) {
    for (const path of paths) {
      try {
        const response = await fetch(`http://localhost:${port}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: "probe_event",
            event_ts: "2026-01-15T16:00:00Z",
            user_id: "probe_user",
            product_id: "probe_product",
            event_type: "view",
            properties: {},
          }),
          signal: AbortSignal.timeout(2000),
        });
        if (response.status < 500) {
          return {
            passed: true,
            message: `Ingest endpoint responded at ${port}${path} (status ${response.status}).`,
            details: { port, path, status: response.status },
          };
        }
      } catch {
        // Try next
      }
    }
  }
  return {
    passed: false,
    message: "No HTTP ingest endpoint responded on common ports/paths.",
    details: {},
  };
}
