import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function assertions_json_filled(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch (err) {
    return { passed: false, message: "Could not read /workspace/assertions.json.", details: { error: String(err) } };
  }
  const hasTrips = typeof meta.tables?.trips === "string" && meta.tables.trips.length > 0;
  const hasMetrics = typeof meta.tables?.metrics === "string" && meta.tables.metrics.length > 0;
  const hasEndpoints = Array.isArray(meta.api_endpoints) && meta.api_endpoints.length >= 3;
  const hasChatEndpoint = typeof meta.chat_endpoint === "string" && meta.chat_endpoint.length > 0;
  const hasAuth = meta.auth_enabled === true;
  const hasGuardrails = meta.guardrails_enabled === true;
  const hasObservability = meta.observability_enabled === true;
  const passed = hasTrips && hasMetrics && hasEndpoints && hasChatEndpoint && hasAuth && hasGuardrails && hasObservability;
  return {
    passed,
    message: passed
      ? "assertions.json is fully populated with all required fields."
      : "assertions.json is missing or has empty fields.",
    details: {
      hasTrips, hasMetrics, hasEndpoints, hasChatEndpoint,
      hasAuth, hasGuardrails, hasObservability,
    },
  };
}

export async function trips_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const table = meta.tables?.trips;
  if (!table) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }
  const parts = table.includes(".") ? table.split(".") : ["default", table];
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? `Trips table ${table} exists.` : `Trips table '${table}' not found.`,
    details: { table, count },
  };
}

export async function metrics_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const table = meta.tables?.metrics;
  if (!table) {
    return { passed: false, message: "tables.metrics not set in assertions.json.", details: {} };
  }
  const parts = table.includes(".") ? table.split(".") : ["default", table];
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? `Metrics table ${table} exists.` : `Metrics table '${table}' not found.`,
    details: { table, count },
  };
}

export async function trips_table_has_multimillion_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const table = meta.tables?.trips;
  if (!table) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${table}`);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 5_000_000;
  return {
    passed,
    message: passed
      ? `Trips table has ${count} rows (> 5M as expected for Jan+Feb 2024).`
      : `Trips table has ${count} rows, expected > 5M for multi-month data.`,
    details: { count },
  };
}

export async function api_endpoints_respond_with_jwt(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = Array.isArray(meta.api_endpoints) ? meta.api_endpoints : [];

  if (endpoints.length < 3) {
    return { passed: false, message: "Expected at least 3 API endpoints in assertions.json.", details: { endpoints } };
  }

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const results: Array<{ endpoint: string; status: number | string }> = [];
  for (const ep of endpoints) {
    const path = typeof ep === "string" ? ep : (ep.path || ep);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${yellowJwt}` },
      });
      results.push({ endpoint: path, status: res.status });
    } catch (e) {
      results.push({ endpoint: path, status: e instanceof Error ? e.message : "error" });
    }
  }

  const okCount = results.filter((r) => r.status === 200).length;
  const passed = okCount >= 3;
  return {
    passed,
    message: passed
      ? `${okCount} of ${results.length} API endpoints respond HTTP 200.`
      : `Only ${okCount} of ${results.length} API endpoints respond HTTP 200.`,
    details: { results },
  };
}

export async function chat_endpoint_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/api/chat";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  try {
    const res = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${yellowJwt}`,
      },
      body: JSON.stringify({ question: "How many trips are there?" }),
    });
    const passed = res.status === 200;
    let body: any = null;
    try {
      body = await res.json();
    } catch {}
    return {
      passed,
      message: passed
        ? "Chat endpoint responds HTTP 200 to a valid question."
        : `Chat endpoint returned HTTP ${res.status}.`,
      details: { status: res.status, body },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach chat endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}

export async function unauthenticated_returns_401(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = Array.isArray(meta.api_endpoints) ? meta.api_endpoints : [];
  const chatEndpoint = meta.chat_endpoint || "/api/chat";

  const testEndpoints = [
    ...(endpoints.length > 0 ? [typeof endpoints[0] === "string" ? endpoints[0] : endpoints[0].path] : ["/api/trips"]),
    chatEndpoint,
  ];

  const results: Array<{ endpoint: string; status: number | string }> = [];
  for (const ep of testEndpoints) {
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
      ? "All tested endpoints return 401 for unauthenticated requests."
      : "Not all endpoints return 401 for unauthenticated requests.",
    details: { results },
  };
}
