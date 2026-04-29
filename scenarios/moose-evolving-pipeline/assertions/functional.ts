import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findEventsTable, probeEgress } from "../../_shared/assertion-helpers";

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

export async function api_server_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "top-products", {
    paths: ["/api/top-products", "/api/revenue-by-region"],
  });
  if (!result) {
    return { passed: false, message: "API server did not respond on ports 3000, 4000, or 8080.", details: {} };
  }
  return {
    passed: true,
    message: `API server responded at ${result.url} (status ${result.response.status}).`,
    details: { url: result.url, status: result.response.status },
  };
}
