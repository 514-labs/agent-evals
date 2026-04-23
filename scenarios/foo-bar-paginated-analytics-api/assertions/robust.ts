import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function fetchPage(
  ctx: AssertionContext,
  baseUrl: string,
  limit: number,
  offset: number,
  headers: Record<string, string>,
): Promise<any | null> {
  const url = new URL(baseUrl);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

export async function offset_returns_different_page(ctx: AssertionContext): Promise<AssertionResult> {
  const base = await probeEgress(ctx, "events", { paths: ["/api/events"] });
  if (!base) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  await base.response.text();
  const authHeader = ctx.env("EGRESS_AUTH_HEADER");
  const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};

  const page0 = await fetchPage(ctx, base.url, 5, 0, headers);
  const page1 = await fetchPage(ctx, base.url, 5, 5, headers);
  const arr0 = page0?.data ?? page0?.events ?? [];
  const arr1 = page1?.data ?? page1?.events ?? [];
  const id0 = arr0[0]?.event_id ?? arr0[0]?.id;
  const id1 = arr1[0]?.event_id ?? arr1[0]?.id;
  const passed = arr0.length > 0 && arr1.length > 0 && id0 !== id1;
  return {
    passed,
    message: passed ? "Offset returns different page." : "Pages overlap or empty.",
    details: { url: base.url, page0FirstId: id0, page1FirstId: id1 },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
