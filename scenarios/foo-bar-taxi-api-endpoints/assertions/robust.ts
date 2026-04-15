import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function empty_date_range_returns_empty_array(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";

  // Find the trips list endpoint
  const endpoints = config.endpoints || [];
  const tripsEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("trip") && !(ep.path || "").includes("top"),
  );
  const tripsPath = tripsEp?.path || "/api/trips";

  try {
    const res = await fetch(`${baseUrl}${tripsPath}?start_date=2099-01-01&end_date=2099-01-02`);
    if (!res.ok && res.status !== 200) {
      return {
        passed: false,
        message: `Empty date range returned status ${res.status}, expected 200 with empty array.`,
        details: { status: res.status },
      };
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.data || [];
    const passed = Array.isArray(items) && items.length === 0;
    return {
      passed,
      message: passed
        ? "Empty date range returns empty array."
        : `Expected empty array for future date range, got ${items.length} items.`,
      details: { itemCount: items.length },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Request failed: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}

export async function invalid_filter_returns_400_not_500(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";

  const endpoints = config.endpoints || [];
  const tripsEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("trip") && !(ep.path || "").includes("top"),
  );
  const tripsPath = tripsEp?.path || "/api/trips";

  try {
    const res = await fetch(`${baseUrl}${tripsPath}?page=-1&page_size=abc`);
    const passed = res.status >= 400 && res.status < 500;
    return {
      passed,
      message: passed
        ? `Invalid params return client error (${res.status}).`
        : `Expected 4xx for invalid params, got ${res.status}.`,
      details: { status: res.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Request failed: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}

export async function pagination_works(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";

  const endpoints = config.endpoints || [];
  const tripsEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("trip") && !(ep.path || "").includes("top"),
  );
  const tripsPath = tripsEp?.path || "/api/trips";

  try {
    const res1 = await fetch(`${baseUrl}${tripsPath}?page=1&page_size=5`);
    const res2 = await fetch(`${baseUrl}${tripsPath}?page=2&page_size=5`);

    if (!res1.ok || !res2.ok) {
      return {
        passed: false,
        message: `Pagination requests failed: page1=${res1.status}, page2=${res2.status}.`,
        details: { page1Status: res1.status, page2Status: res2.status },
      };
    }

    const data1 = await res1.json();
    const data2 = await res2.json();
    const items1 = Array.isArray(data1) ? data1 : data1.data || [];
    const items2 = Array.isArray(data2) ? data2 : data2.data || [];

    const page1Has5 = items1.length === 5;
    const page2Has5 = items2.length === 5;
    const pagesAreDifferent =
      items1.length > 0 &&
      items2.length > 0 &&
      JSON.stringify(items1[0]) !== JSON.stringify(items2[0]);

    const passed = page1Has5 && page2Has5 && pagesAreDifferent;
    return {
      passed,
      message: passed
        ? "Pagination returns correct page sizes with different data."
        : `Pagination issue: page1=${items1.length} items, page2=${items2.length} items, different=${pagesAreDifferent}.`,
      details: { page1Count: items1.length, page2Count: items2.length, pagesAreDifferent },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Request failed: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}
