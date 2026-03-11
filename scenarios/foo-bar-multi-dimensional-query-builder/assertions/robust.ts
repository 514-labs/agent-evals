import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function filter_reduces_result(ctx: AssertionContext): Promise<AssertionResult> {
  const allData = await fetchJson("http://localhost:3000/api/metrics");
  const filteredData = await fetchJson("http://localhost:3000/api/metrics?region_id=1");
  const allTotal = Number(allData?.total_value ?? allData?.totalValue ?? allData?.sum ?? 0);
  const filteredTotal = Number(filteredData?.total_value ?? filteredData?.totalValue ?? filteredData?.sum ?? 0);
  const passed = filteredTotal <= allTotal && (allTotal === 0 || filteredTotal < allTotal || filteredTotal > 0);
  return {
    passed,
    message: passed ? "Filter reduces or returns subset." : "Filter behavior unexpected.",
    details: { allTotal, filteredTotal },
  };
}
