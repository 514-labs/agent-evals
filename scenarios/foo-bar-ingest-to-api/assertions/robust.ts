import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { fetchEgressJson, probeEgress } from "../../_shared/assertion-helpers";

export async function api_returns_valid_json_content_type(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "top-products", {
    paths: ["/api/top-products", "/api/topProducts"],
  });
  if (!result) {
    return { passed: false, message: "Top products endpoint unreachable.", details: {} };
  }
  const ct = result.response.headers.get("content-type") ?? "";
  const passed = ct.includes("application/json");
  return {
    passed,
    message: passed ? "API returns valid JSON content-type." : `Content-Type: ${ct}.`,
    details: { url: result.url, contentType: ct },
  };
}

export async function api_handles_unknown_route(ctx: AssertionContext): Promise<AssertionResult> {
  // Probe an intentionally-nonexistent egress name. Helper will fall back
  // to port-scan with the given path. We expect 404 or 400.
  const result = await probeEgress(ctx, "unknown-route-probe", {
    paths: ["/api/nonexistent"],
  });
  if (!result) {
    // Nothing responded — treat as "API didn't reject our unknown route
    // because it's not even running". That's a failure.
    return { passed: false, message: "API did not respond to unknown route probe.", details: {} };
  }
  const passed = result.response.status === 404 || result.response.status === 400;
  return {
    passed,
    message: passed ? "API handles unknown route." : `Unexpected status ${result.response.status} for unknown route.`,
    details: { url: result.url, status: result.response.status },
  };
}

export async function no_duplicate_products_in_top(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEgressJson<unknown[]>(ctx, "top-products", {
    paths: ["/api/top-products", "/api/topProducts"],
  });
  const data = result?.data;
  if (!Array.isArray(data)) {
    return {
      passed: false,
      message: "Top products API returned invalid data.",
      details: { url: result?.url },
    };
  }
  const ids = data.map((r: any) => r.product_id ?? r.id ?? "");
  const passed = new Set(ids).size === ids.length;
  return {
    passed,
    message: passed ? "No duplicate products in top." : `Found ${ids.length - new Set(ids).size} duplicates.`,
    details: { url: result?.url, uniqueCount: new Set(ids).size, totalCount: ids.length },
  };
}
