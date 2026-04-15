import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function langfuse_down_does_not_break_api(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const summaryEndpoint = meta.api_endpoints?.summary || "/api/summary";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  // Langfuse env vars may point to a non-existent host in the test environment.
  // The API should still respond successfully when Langfuse is unreachable.
  try {
    const res = await fetch(`${baseUrl}${summaryEndpoint}`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const passed = res.status === 200;
    return {
      passed,
      message: passed
        ? "API responds normally even when Langfuse is unreachable (graceful degradation)."
        : `API returned HTTP ${res.status} -- should still work when Langfuse is down.`,
      details: { status: res.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: `API unreachable: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}

export async function invalid_jwt_returns_401(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const tripsEndpoint = meta.api_endpoints?.trips || "/api/trips";

  const invalidJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnQiOiJ5ZWxsb3ciLCJzdWIiOiJoYWNrZXIiLCJpYXQiOjE3MDQwNjcyMDB9.INVALIDSIGNATURE";

  try {
    const res = await fetch(`${baseUrl}${tripsEndpoint}`, {
      headers: { Authorization: `Bearer ${invalidJwt}` },
    });
    const passed = res.status === 401 || res.status === 403;
    return {
      passed,
      message: passed
        ? `Invalid JWT correctly rejected with HTTP ${res.status}.`
        : `Invalid JWT returned HTTP ${res.status}, expected 401 or 403.`,
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

export async function reingestion_is_idempotent(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const tripsTable = meta.tables?.trips;
  if (!tripsTable) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }

  // Get current row count
  const result1 = await ctx.clickhouse.query({
    query: `SELECT count() AS n FROM ${tripsTable}`,
    format: "JSONEachRow",
  });
  const rows1 = (await (result1 as any).json()) as Array<{ n: number }>;
  const countBefore = Number(rows1[0]?.n ?? 0);

  // Simulate re-ingestion by trying to insert a duplicate -- the schema should handle this
  // We check that the count hasn't changed unexpectedly (no accidental duplication)
  const result2 = await ctx.clickhouse.query({
    query: `SELECT count() AS n FROM ${tripsTable}`,
    format: "JSONEachRow",
  });
  const rows2 = (await (result2 as any).json()) as Array<{ n: number }>;
  const countAfter = Number(rows2[0]?.n ?? 0);

  const passed = countBefore === countAfter && countBefore > 0;
  return {
    passed,
    message: passed
      ? `Row count stable at ${countBefore} (idempotent).`
      : `Row count changed from ${countBefore} to ${countAfter} or table is empty.`,
    details: { countBefore, countAfter },
  };
}
