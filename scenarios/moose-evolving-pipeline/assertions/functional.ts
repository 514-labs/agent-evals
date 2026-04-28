import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findEventsTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function events_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  const passed = found !== null;
  return {
    passed,
    message: passed
      ? `Events table exists at ${found!.database}.${found!.table}.`
      : "No events table found in any non-system database.",
    details: { found },
  };
}

export async function api_server_responds(): Promise<AssertionResult> {
  for (const port of [3000, 4000, 8080]) {
    for (const path of ["/api/top-products", "/api/revenue-by-region"]) {
      try {
        const response = await fetch(`http://localhost:${port}${path}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok || response.status < 500) {
          return {
            passed: true,
            message: `API server responded on port ${port} (status ${response.status}).`,
            details: { port, path, status: response.status },
          };
        }
      } catch {}
    }
  }
  return {
    passed: false,
    message: "API server did not respond on ports 3000, 4000, or 8080.",
    details: {},
  };
}
