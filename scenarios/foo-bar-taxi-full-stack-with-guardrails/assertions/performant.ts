import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function dashboard_endpoint_under_500ms(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = Array.isArray(meta.api_endpoints) ? meta.api_endpoints : [];
  const summaryEndpoint = endpoints.find((ep: any) => {
    const path = typeof ep === "string" ? ep : ep.path;
    return path && path.includes("summary");
  });
  const summaryPath = typeof summaryEndpoint === "string" ? summaryEndpoint : (summaryEndpoint?.path || "/api/summary");

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${summaryPath}`, {
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
        ? `Dashboard/summary endpoint responded in ${elapsed}ms (< 500ms).`
        : `Dashboard/summary endpoint took ${elapsed}ms (expected < 500ms).`,
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

export async function trips_endpoint_under_500ms(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = Array.isArray(meta.api_endpoints) ? meta.api_endpoints : [];
  const tripsEndpoint = endpoints.find((ep: any) => {
    const path = typeof ep === "string" ? ep : ep.path;
    return path && path.includes("trip");
  });
  const tripsPath = typeof tripsEndpoint === "string" ? tripsEndpoint : (tripsEndpoint?.path || "/api/trips");

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${tripsPath}?limit=100`, {
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

export async function chat_endpoint_under_5s(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/api/chat";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${yellowJwt}`,
      },
      body: JSON.stringify({ question: "What is the average fare amount?" }),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return { passed: false, message: `Chat endpoint returned HTTP ${res.status}.`, details: { status: res.status, elapsedMs: elapsed } };
    }
    const passed = elapsed < 5000;
    return {
      passed,
      message: passed
        ? `Chat endpoint responded in ${elapsed}ms (< 5000ms).`
        : `Chat endpoint took ${elapsed}ms (expected < 5000ms).`,
      details: { elapsedMs: elapsed },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach chat endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}
