import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function offset_returns_different_page(ctx: AssertionContext): Promise<AssertionResult> {
  const page0 = await fetchJson("http://localhost:3000/api/events?limit=5&offset=0");
  const page1 = await fetchJson("http://localhost:3000/api/events?limit=5&offset=5");
  const arr0 = page0?.data ?? page0?.events ?? [];
  const arr1 = page1?.data ?? page1?.events ?? [];
  const id0 = arr0[0]?.event_id ?? arr0[0]?.id;
  const id1 = arr1[0]?.event_id ?? arr1[0]?.id;
  const passed = arr0.length > 0 && arr1.length > 0 && id0 !== id1;
  return {
    passed,
    message: passed ? "Offset returns different page." : "Pages overlap or empty.",
    details: { page0FirstId: id0, page1FirstId: id1 },
  };
}
