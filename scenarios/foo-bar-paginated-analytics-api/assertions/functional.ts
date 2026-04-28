import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { probeEgress } from "../../_shared/assertion-helpers";

async function fetchEventsWithParams(
  ctx: AssertionContext,
  params: Record<string, string | number>,
): Promise<{ url: string; response: Response } | null> {
  const base = await probeEgress(ctx, "events", { paths: ["/api/events"] });
  if (!base) return null;
  await base.response.text();
  const url = new URL(base.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const authHeader = ctx.env("EGRESS_AUTH_HEADER");
  const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};
  const res = await fetch(url, { headers });
  return { url: url.toString(), response: res };
}

export async function api_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEventsWithParams(ctx, { limit: 10, offset: 0 });
  if (!result) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  const passed = result.response.ok;
  return {
    passed,
    message: passed ? "API responds." : `API returned status ${result.response.status}.`,
    details: { url: result.url, status: result.response.status },
  };
}

export async function returns_data_array(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEventsWithParams(ctx, { limit: 5, offset: 0 });
  if (!result) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  try {
    const data: any = await result.response.json();
    const arr = data?.data ?? data?.events ?? data;
    const passed = Array.isArray(arr);
    return {
      passed,
      message: passed ? "Returns data array." : "Response missing data array.",
      details: { url: result.url, hasArray: passed },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API did not return valid JSON.",
      details: { url: result.url, error: e instanceof Error ? e.message : String(e) },
    };
  }
}
