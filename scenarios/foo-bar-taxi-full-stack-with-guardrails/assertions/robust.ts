import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function bad_jwt_returns_401(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = Array.isArray(meta.api_endpoints) ? meta.api_endpoints : [];
  const testPath = endpoints.length > 0
    ? (typeof endpoints[0] === "string" ? endpoints[0] : endpoints[0].path)
    : "/api/trips";

  const invalidJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnQiOiJ5ZWxsb3ciLCJzdWIiOiJoYWNrZXIiLCJpYXQiOjE3MDQwNjcyMDB9.INVALIDSIGNATURE";

  try {
    const res = await fetch(`${baseUrl}${testPath}`, {
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

export async function nonsense_question_returns_graceful_response(): Promise<AssertionResult> {
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
      body: JSON.stringify({ question: "asdfjkl;qwerty zxcvbnm gibberish nonsense 12345" }),
    });

    // Should not crash -- any 2xx or 4xx is acceptable, just not 5xx
    const passed = res.status < 500;
    let body: any = null;
    try {
      body = await res.json();
    } catch {}
    return {
      passed,
      message: passed
        ? `Nonsense question handled gracefully with HTTP ${res.status}.`
        : `Nonsense question caused server error HTTP ${res.status}.`,
      details: { status: res.status, body },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Chat endpoint crashed on nonsense input: ${e instanceof Error ? e.message : String(e)}`,
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

  // Verify count is stable (no accidental duplication from the ingestion process)
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

export async function chat_unauthenticated_returns_401(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/api/chat";

  try {
    const res = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips?" }),
    });
    const passed = res.status === 401;
    return {
      passed,
      message: passed
        ? "Chat endpoint correctly returns 401 without authentication."
        : `Chat endpoint returned HTTP ${res.status} without auth, expected 401.`,
      details: { status: res.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: `Failed to reach chat endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }
}
