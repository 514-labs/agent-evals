import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function no_jwt_returns_401(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  try {
    const resp = await fetch(`${baseUrl}${tripsEndpoint}?limit=1`);
    const passed = resp.status === 401;
    return {
      passed,
      message: passed
        ? "Request without JWT correctly returned 401."
        : `Request without JWT returned HTTP ${resp.status} (expected 401).`,
      details: { status: resp.status },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function invalid_jwt_returns_401(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  try {
    const resp = await fetch(`${baseUrl}${tripsEndpoint}?limit=1`, {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    const passed = resp.status === 401;
    return {
      passed,
      message: passed
        ? "Request with invalid JWT correctly returned 401."
        : `Request with invalid JWT returned HTTP ${resp.status} (expected 401).`,
      details: { status: resp.status },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
