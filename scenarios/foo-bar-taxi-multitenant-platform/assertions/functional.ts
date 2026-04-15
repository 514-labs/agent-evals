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
  const hasDailyMetrics = typeof meta.tables?.daily_metrics === "string" && meta.tables.daily_metrics.length > 0;
  const hasTripsEndpoint = typeof meta.api_endpoints?.trips === "string" && meta.api_endpoints.trips.length > 0;
  const hasMetricsEndpoint = typeof meta.api_endpoints?.metrics === "string" && meta.api_endpoints.metrics.length > 0;
  const hasSummaryEndpoint = typeof meta.api_endpoints?.summary === "string" && meta.api_endpoints.summary.length > 0;
  const hasJwtHeader = typeof meta.auth?.jwt_header === "string" && meta.auth.jwt_header.length > 0;
  const hasTenantClaim = typeof meta.auth?.tenant_claim === "string" && meta.auth.tenant_claim.length > 0;
  const hasLangfuse = meta.observability?.langfuse_configured === true;
  const passed = hasTrips && hasDailyMetrics && hasTripsEndpoint && hasMetricsEndpoint && hasSummaryEndpoint && hasJwtHeader && hasTenantClaim && hasLangfuse;
  return {
    passed,
    message: passed
      ? "assertions.json is fully populated with all required fields."
      : "assertions.json is missing or has empty fields.",
    details: {
      hasTrips, hasDailyMetrics, hasTripsEndpoint, hasMetricsEndpoint,
      hasSummaryEndpoint, hasJwtHeader, hasTenantClaim, hasLangfuse,
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

export async function daily_metrics_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const table = meta.tables?.daily_metrics;
  if (!table) {
    return { passed: false, message: "tables.daily_metrics not set in assertions.json.", details: {} };
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
    message: passed ? `Daily metrics table ${table} exists.` : `Daily metrics table '${table}' not found.`,
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

export async function api_endpoints_respond_with_yellow_jwt(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = [meta.api_endpoints?.trips, meta.api_endpoints?.summary];

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  const results: Array<{ endpoint: string; status: number | string }> = [];
  for (const ep of endpoints) {
    if (!ep) {
      results.push({ endpoint: "(not set)", status: "missing" });
      continue;
    }
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${yellowJwt}` },
      });
      results.push({ endpoint: ep, status: res.status });
    } catch (e) {
      results.push({ endpoint: ep, status: e instanceof Error ? e.message : "error" });
    }
  }

  const okCount = results.filter((r) => r.status === 200).length;
  const passed = okCount >= 2;
  return {
    passed,
    message: passed
      ? `${okCount} endpoints respond HTTP 200 with yellow JWT.`
      : `Only ${okCount} endpoints respond HTTP 200 with yellow JWT.`,
    details: { results },
  };
}

export async function unauthenticated_returns_401(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const ep = meta.api_endpoints?.trips || "/api/trips";

  try {
    const res = await fetch(`${baseUrl}${ep}`);
    const passed = res.status === 401;
    return {
      passed,
      message: passed
        ? "Unauthenticated request correctly returns HTTP 401."
        : `Unauthenticated request returned HTTP ${res.status}, expected 401.`,
      details: { status: res.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}
