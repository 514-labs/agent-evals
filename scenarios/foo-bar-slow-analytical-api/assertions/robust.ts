import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function api_returns_json(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "metrics", { paths: ["/api/metrics"] });
  if (!result) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  const ct = result.response.headers.get("content-type") ?? "";
  const passed = ct.includes("application/json");
  return {
    passed,
    message: passed ? "API returns JSON." : `Content-Type: ${ct}.`,
    details: { url: result.url, contentType: ct },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
