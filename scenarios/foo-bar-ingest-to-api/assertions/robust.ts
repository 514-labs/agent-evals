import type { AssertionContext } from "@dec-bench/eval-core";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function api_returns_valid_json_content_type(): Promise<boolean> {
  const res = await fetch("http://localhost:3000/api/top-products");
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

export async function api_handles_unknown_route(): Promise<boolean> {
  const res = await fetch("http://localhost:3000/api/nonexistent");
  return res.status === 404 || res.status === 400;
}

export async function no_duplicate_products_in_top(): Promise<boolean> {
  const data = await fetchJson("http://localhost:3000/api/top-products");
  if (!Array.isArray(data)) return false;
  const ids = data.map((r: any) => r.product_id ?? r.id ?? "");
  return new Set(ids).size === ids.length;
}
