import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { probeEgress } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

// Fetch the events endpoint with the given query params. Resolves the base URL
// via probeEgress once, then composes params using URL() so env-configured URLs
// (which may carry ?token=...) merge cleanly.
async function fetchEventsWithParams(
  ctx: AssertionContext,
  params: Record<string, string | number>,
): Promise<{ url: string; data: any } | null> {
  const base = await probeEgress(ctx, "events", { paths: ["/api/events"] });
  if (!base || !base.response.ok) return null;
  // Drain first response body; we refetch with params anyway.
  await base.response.text();
  const url = new URL(base.url);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const authHeader = ctx.env("EGRESS_AUTH_HEADER");
  const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  try {
    const data = await res.json();
    return { url: url.toString(), data };
  } catch {
    return null;
  }
}

export async function total_matches_source_count(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const expectedTotal = Number(rows[0]?.n ?? 0);

  const result = await fetchEventsWithParams(ctx, { limit: 1, offset: 0 });
  if (!result) {
    return {
      passed: false,
      message: "Events API did not return JSON.",
      details: { expectedTotal },
    };
  }
  const actualTotal = Number(result.data?.total ?? result.data?.totalCount ?? -1);
  const passed = actualTotal === expectedTotal;
  return {
    passed,
    message: passed ? "Total matches source count." : `Expected total ${expectedTotal}, got ${actualTotal}.`,
    details: { url: result.url, expectedTotal, actualTotal },
  };
}

export async function limit_respected(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEventsWithParams(ctx, { limit: 7, offset: 0 });
  if (!result) {
    return { passed: false, message: "Events API did not return JSON.", details: {} };
  }
  const arr = result.data?.data ?? result.data?.events ?? [];
  const passed = arr.length <= 7;
  return {
    passed,
    message: passed ? "Limit respected." : `Expected at most 7 rows, got ${arr.length}.`,
    details: { url: result.url, returnedCount: arr.length },
  };
}
