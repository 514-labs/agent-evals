import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function filter_reduces_result(ctx: AssertionContext): Promise<AssertionResult> {
  // Resolve base URL once; append query params for the filtered call so
  // env-configured URLs (which may already carry ?token=...) compose safely.
  const base = await probeEgress(ctx, "metrics", { paths: ["/api/metrics"] });
  if (!base || !base.response.ok) {
    return { passed: false, message: "API did not respond.", details: { url: base?.url } };
  }
  const authHeader = ctx.env("EGRESS_AUTH_HEADER");
  const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};
  const allData: any = await base.response.json().catch(() => null);

  const filteredUrl = new URL(base.url);
  filteredUrl.searchParams.set("region_id", "1");
  const filteredRes = await fetch(filteredUrl, { headers });
  if (!filteredRes.ok) {
    return {
      passed: false,
      message: `Filtered request returned ${filteredRes.status}.`,
      details: { url: filteredUrl.toString(), status: filteredRes.status },
    };
  }
  const filteredData: any = await filteredRes.json().catch(() => null);

  const allTotal = Number(allData?.total_value ?? allData?.totalValue ?? allData?.sum ?? 0);
  const filteredTotal = Number(filteredData?.total_value ?? filteredData?.totalValue ?? filteredData?.sum ?? 0);
  const passed = filteredTotal <= allTotal && (allTotal === 0 || filteredTotal < allTotal || filteredTotal > 0);
  return {
    passed,
    message: passed ? "Filter reduces or returns subset." : "Filter behavior unexpected.",
    details: { url: base.url, allTotal, filteredTotal },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
