import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function handles_concurrent_requests(ctx: AssertionContext): Promise<AssertionResult> {
  // First resolve the endpoint URL once via probe; then hammer that URL.
  const first = await probeEgress(ctx, "metrics", { paths: ["/api/metrics"], timeoutMs: 3000 });
  if (!first || !first.response.ok) {
    return {
      passed: false,
      message: "API did not respond on first probe.",
      details: { url: first?.url, status: first?.response.status },
    };
  }
  await first.response.text();
  const url = first.url;
  const authHeader = ctx.env("EGRESS_AUTH_HEADER");
  const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};

  const concurrency = 5;
  const promises = Array.from({ length: concurrency }, () =>
    fetch(url, { headers }).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(`Status ${r.status}`)),
    ),
  );
  const results = await Promise.allSettled(promises);
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const passed = fulfilled >= concurrency;
  return {
    passed,
    message: passed ? "Handles concurrent requests." : `${fulfilled}/${concurrency} concurrent requests succeeded.`,
    details: { url, fulfilled, total: concurrency },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
