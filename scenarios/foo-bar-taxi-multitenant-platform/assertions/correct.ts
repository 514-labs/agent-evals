import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function yellow_jwt_returns_only_yellow_trips(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const tripsEndpoint = meta.api_endpoints?.trips || "/api/trips";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  let data: any;
  try {
    data = await fetchJson(`${baseUrl}${tripsEndpoint}?limit=50`, {
      Authorization: `Bearer ${yellowJwt}`,
    });
  } catch (e) {
    return {
      passed: false,
      message: `Failed to fetch trips with yellow JWT: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }

  const trips = Array.isArray(data) ? data : (data.trips || data.data || data.rows || []);
  if (trips.length === 0) {
    return { passed: false, message: "No trips returned for yellow JWT.", details: {} };
  }

  const nonYellow = trips.filter((t: any) => t.taxi_type !== "yellow");
  const passed = nonYellow.length === 0;
  return {
    passed,
    message: passed
      ? `All ${trips.length} returned trips are yellow-only (tenant isolation works).`
      : `Found ${nonYellow.length} non-yellow trips in yellow JWT response -- tenant isolation broken.`,
    details: { totalReturned: trips.length, nonYellowCount: nonYellow.length },
  };
}

export async function green_jwt_returns_only_green_trips(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const tripsEndpoint = meta.api_endpoints?.trips || "/api/trips";

  let greenJwt: string;
  try {
    greenJwt = readFileSync("/data/auth/green-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/green-tenant.jwt.", details: {} };
  }

  let data: any;
  try {
    data = await fetchJson(`${baseUrl}${tripsEndpoint}?limit=50`, {
      Authorization: `Bearer ${greenJwt}`,
    });
  } catch (e) {
    return {
      passed: false,
      message: `Failed to fetch trips with green JWT: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }

  const trips = Array.isArray(data) ? data : (data.trips || data.data || data.rows || []);
  if (trips.length === 0) {
    return { passed: false, message: "No trips returned for green JWT.", details: {} };
  }

  const nonGreen = trips.filter((t: any) => t.taxi_type !== "green");
  const passed = nonGreen.length === 0;
  return {
    passed,
    message: passed
      ? `All ${trips.length} returned trips are green-only (tenant isolation works).`
      : `Found ${nonGreen.length} non-green trips in green JWT response -- tenant isolation broken.`,
    details: { totalReturned: trips.length, nonGreenCount: nonGreen.length },
  };
}

export async function metrics_match_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const metricsEndpoint = meta.api_endpoints?.metrics || "/api/metrics";
  const tripsTable = meta.tables?.trips;

  if (!tripsTable) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  // Ground truth: avg fare from the trips table for yellow
  const rawRows = await queryRows<{ avg_fare: number }>(
    ctx,
    `SELECT avg(fare_amount) AS avg_fare FROM ${tripsTable} WHERE taxi_type = 'yellow'`,
  );
  const rawAvgFare = Number(rawRows[0]?.avg_fare ?? 0);

  // API value
  let apiAvgFare: number;
  try {
    const metricPath = metricsEndpoint.endsWith("/") ? `${metricsEndpoint}avg_fare` : `${metricsEndpoint}/avg_fare`;
    const data = await fetchJson(`${baseUrl}${metricPath}`, {
      Authorization: `Bearer ${yellowJwt}`,
    });
    apiAvgFare = Number(data.value ?? data.avg_fare ?? data.result ?? 0);
  } catch (e) {
    return {
      passed: false,
      message: `Failed to fetch avg_fare metric: ${e instanceof Error ? e.message : String(e)}`,
      details: { rawAvgFare },
    };
  }

  const tolerance = rawAvgFare * 0.05;
  const passed = Math.abs(rawAvgFare - apiAvgFare) < tolerance && apiAvgFare > 0;
  return {
    passed,
    message: passed
      ? `avg_fare metric matches ground truth (api=${apiAvgFare.toFixed(2)}, raw=${rawAvgFare.toFixed(2)}).`
      : `avg_fare mismatch: api=${apiAvgFare.toFixed(2)}, raw=${rawAvgFare.toFixed(2)}.`,
    details: { rawAvgFare, apiAvgFare, tolerance },
  };
}

export async function summary_revenue_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const summaryEndpoint = meta.api_endpoints?.summary || "/api/summary";
  const tripsTable = meta.tables?.trips;

  if (!tripsTable) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  // Ground truth: total revenue from trips table for yellow
  const rawRows = await queryRows<{ total_rev: number }>(
    ctx,
    `SELECT sum(total_amount) AS total_rev FROM ${tripsTable} WHERE taxi_type = 'yellow'`,
  );
  const rawTotal = Number(rawRows[0]?.total_rev ?? 0);

  let apiTotal: number;
  try {
    const data = await fetchJson(`${baseUrl}${summaryEndpoint}`, {
      Authorization: `Bearer ${yellowJwt}`,
    });
    apiTotal = Number(data.total_revenue ?? data.totalRevenue ?? data.revenue ?? 0);
  } catch (e) {
    return {
      passed: false,
      message: `Failed to fetch summary: ${e instanceof Error ? e.message : String(e)}`,
      details: { rawTotal },
    };
  }

  const tolerance = rawTotal * 0.05;
  const passed = Math.abs(rawTotal - apiTotal) < tolerance && apiTotal > 0;
  return {
    passed,
    message: passed
      ? `Summary revenue matches ground truth (api=${apiTotal.toFixed(2)}, raw=${rawTotal.toFixed(2)}).`
      : `Revenue mismatch: api=${apiTotal.toFixed(2)}, raw=${rawTotal.toFixed(2)}.`,
    details: { rawTotal, apiTotal, tolerance },
  };
}

export async function unauthenticated_request_returns_401(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";

  const endpoints = [
    meta.api_endpoints?.trips || "/api/trips",
    meta.api_endpoints?.metrics ? `${meta.api_endpoints.metrics}/avg_fare` : "/api/metrics/avg_fare",
    meta.api_endpoints?.summary || "/api/summary",
  ];

  const results: Array<{ endpoint: string; status: number | string }> = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`);
      results.push({ endpoint: ep, status: res.status });
    } catch (e) {
      results.push({ endpoint: ep, status: e instanceof Error ? e.message : "error" });
    }
  }

  const all401 = results.every((r) => r.status === 401);
  return {
    passed: all401,
    message: all401
      ? "All endpoints return 401 for unauthenticated requests."
      : "Not all endpoints return 401 for unauthenticated requests.",
    details: { results },
  };
}
