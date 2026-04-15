import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function trips_endpoint_under_500ms(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const tripsEndpoint = meta.api_endpoints?.trips || "/api/trips";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${tripsEndpoint}?limit=100`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return { passed: false, message: `Trips endpoint returned HTTP ${res.status}.`, details: { status: res.status, elapsedMs: elapsed } };
    }
    const passed = elapsed < 500;
    return {
      passed,
      message: passed
        ? `Trips endpoint responded in ${elapsed}ms (< 500ms).`
        : `Trips endpoint took ${elapsed}ms (expected < 500ms).`,
      details: { elapsedMs: elapsed },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach trips endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}

export async function metrics_endpoint_under_200ms(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const metricsEndpoint = meta.api_endpoints?.metrics || "/api/metrics";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const metricPath = metricsEndpoint.endsWith("/") ? `${metricsEndpoint}avg_fare` : `${metricsEndpoint}/avg_fare`;

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${metricPath}`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return { passed: false, message: `Metrics endpoint returned HTTP ${res.status}.`, details: { status: res.status, elapsedMs: elapsed } };
    }
    const passed = elapsed < 200;
    return {
      passed,
      message: passed
        ? `Metrics endpoint responded in ${elapsed}ms (< 200ms).`
        : `Metrics endpoint took ${elapsed}ms (expected < 200ms).`,
      details: { elapsedMs: elapsed },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach metrics endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}

export async function summary_endpoint_under_500ms(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const summaryEndpoint = meta.api_endpoints?.summary || "/api/summary";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${summaryEndpoint}`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return { passed: false, message: `Summary endpoint returned HTTP ${res.status}.`, details: { status: res.status, elapsedMs: elapsed } };
    }
    const passed = elapsed < 500;
    return {
      passed,
      message: passed
        ? `Summary endpoint responded in ${elapsed}ms (< 500ms).`
        : `Summary endpoint took ${elapsed}ms (expected < 500ms).`,
      details: { elapsedMs: elapsed },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach summary endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}
