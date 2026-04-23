import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function first_page_under_300ms(ctx: AssertionContext): Promise<AssertionResult> {
  const base = await probeEgress(ctx, "events", { paths: ["/api/events"], timeoutMs: 3000 });
  if (!base) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  await base.response.text();
  const url = new URL(base.url);
  url.searchParams.set("limit", "20");
  url.searchParams.set("offset", "0");
  const authHeader = ctx.env("EGRESS_AUTH_HEADER");
  const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};

  const start = Date.now();
  const res = await fetch(url, { headers });
  await res.text();
  const elapsed = Date.now() - start;
  const passed = res.ok && elapsed < 300;
  return {
    passed,
    message: passed ? "First page under 300ms." : `Response took ${elapsed}ms.`,
    details: { url: url.toString(), elapsedMs: elapsed, status: res.status },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
