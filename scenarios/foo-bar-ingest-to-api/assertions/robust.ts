import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function api_returns_valid_json_content_type(): Promise<AssertionResult> {
  const res = await fetch("http://localhost:3000/api/top-products");
  const ct = res.headers.get("content-type") ?? "";
  const passed = ct.includes("application/json");
  return {
    passed,
    message: passed ? "API returns valid JSON content-type." : `Content-Type: ${ct}.`,
    details: { contentType: ct },
  };
}

export async function api_handles_unknown_route(): Promise<AssertionResult> {
  const res = await fetch("http://localhost:3000/api/nonexistent");
  const passed = res.status === 404 || res.status === 400;
  return {
    passed,
    message: passed ? "API handles unknown route." : `Unexpected status ${res.status} for unknown route.`,
    details: { status: res.status },
  };
}

export async function no_duplicate_products_in_top(): Promise<AssertionResult> {
  const data = await fetchJson("http://localhost:3000/api/top-products");
  if (!Array.isArray(data)) {
    return {
      passed: false,
      message: "Top products API returned invalid data.",
    };
  }
  const ids = data.map((r: any) => r.product_id ?? r.id ?? "");
  const passed = new Set(ids).size === ids.length;
  return {
    passed,
    message: passed ? "No duplicate products in top." : `Found ${ids.length - new Set(ids).size} duplicates.`,
    details: { uniqueCount: new Set(ids).size, totalCount: ids.length },
  };
}
