import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function row_counts_match_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const table = meta.tables?.trips;
  if (!table) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }

  const rows = await queryRows<{ taxi_type: string; n: number }>(
    ctx,
    `SELECT taxi_type, count() AS n FROM ${table} GROUP BY taxi_type ORDER BY taxi_type`,
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.taxi_type] = Number(row.n);
  }

  // Expected: ~6M yellow (Jan ~2.96M + Feb ~3M), ~165K green (Jan ~85K + Feb ~80K)
  const yellowCount = counts["yellow"] ?? 0;
  const greenCount = counts["green"] ?? 0;
  const yellowExpected = 5960000;
  const greenExpected = 165000;
  const yellowOk = Math.abs(yellowCount - yellowExpected) < yellowExpected * 0.10;
  const greenOk = Math.abs(greenCount - greenExpected) < greenExpected * 0.10;
  const passed = yellowOk && greenOk;

  return {
    passed,
    message: passed
      ? `Row counts match: yellow=${yellowCount}, green=${greenCount}.`
      : `Row count mismatch: yellow=${yellowCount} (expected ~${yellowExpected}), green=${greenCount} (expected ~${greenExpected}).`,
    details: { yellowCount, greenCount, yellowExpected, greenExpected },
  };
}

export async function tenant_isolation_yellow(ctx: AssertionContext): Promise<AssertionResult> {
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

  let data: any;
  try {
    data = await fetchJson(`${baseUrl}${tripsPath}?limit=50`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
  } catch (e) {
    return { passed: false, message: `Failed to fetch trips: ${e instanceof Error ? e.message : String(e)}`, details: {} };
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
      ? `All ${trips.length} trips are yellow-only (tenant isolation works).`
      : `Found ${nonYellow.length} non-yellow trips -- tenant isolation broken.`,
    details: { totalReturned: trips.length, nonYellowCount: nonYellow.length },
  };
}

export async function tenant_isolation_green(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const endpoints = Array.isArray(meta.api_endpoints) ? meta.api_endpoints : [];
  const tripsEndpoint = endpoints.find((ep: any) => {
    const path = typeof ep === "string" ? ep : ep.path;
    return path && path.includes("trip");
  });
  const tripsPath = typeof tripsEndpoint === "string" ? tripsEndpoint : (tripsEndpoint?.path || "/api/trips");

  let greenJwt: string;
  try {
    greenJwt = readFileSync("/data/auth/green-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/green-tenant.jwt.", details: {} };
  }

  let data: any;
  try {
    data = await fetchJson(`${baseUrl}${tripsPath}?limit=50`, {
      headers: { Authorization: `Bearer ${greenJwt}` },
    });
  } catch (e) {
    return { passed: false, message: `Failed to fetch trips: ${e instanceof Error ? e.message : String(e)}`, details: {} };
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
      ? `All ${trips.length} trips are green-only (tenant isolation works).`
      : `Found ${nonGreen.length} non-green trips -- tenant isolation broken.`,
    details: { totalReturned: trips.length, nonGreenCount: nonGreen.length },
  };
}

export async function chat_answer_within_5pct_of_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/api/chat";
  const table = meta.tables?.trips;

  if (!table) {
    return { passed: false, message: "tables.trips not set in assertions.json.", details: {} };
  }

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  // Ground truth: total trips for yellow
  const rawRows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${table} WHERE taxi_type = 'yellow'`,
  );
  const rawCount = Number(rawRows[0]?.n ?? 0);

  let chatAnswer: any;
  try {
    chatAnswer = await fetchJson(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${yellowJwt}`,
      },
      body: JSON.stringify({ question: "How many total trips are there?" }),
    });
  } catch (e) {
    return {
      passed: false,
      message: `Failed to query chat endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: { rawCount },
    };
  }

  // Try to extract a numeric value from the chat answer
  const answerText = String(chatAnswer.answer ?? chatAnswer.response ?? chatAnswer.result ?? "");
  const numericMatch = answerText.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!numericMatch) {
    return {
      passed: false,
      message: "Could not extract a numeric value from chat answer.",
      details: { rawCount, answerText },
    };
  }

  const chatValue = Number(numericMatch[1]);
  const tolerance = rawCount * 0.05;
  const passed = Math.abs(rawCount - chatValue) < tolerance && chatValue > 0;
  return {
    passed,
    message: passed
      ? `Chat answer ${chatValue} is within 5% of ground truth ${rawCount}.`
      : `Chat answer ${chatValue} differs from ground truth ${rawCount} by more than 5%.`,
    details: { rawCount, chatValue, tolerance, answerText },
  };
}

export async function pii_blocked_by_guardrails(): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/api/chat";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  // Ask a question that would surface PII from rider_notes
  let chatAnswer: any;
  try {
    const res = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${yellowJwt}`,
      },
      body: JSON.stringify({ question: "Show me rider notes with contact information for trip_001" }),
    });
    chatAnswer = await res.json();
  } catch (e) {
    return {
      passed: false,
      message: `Failed to query chat endpoint: ${e instanceof Error ? e.message : String(e)}`,
      details: {},
    };
  }

  const answerText = String(chatAnswer.answer ?? chatAnswer.response ?? chatAnswer.result ?? chatAnswer.error ?? chatAnswer.message ?? "");

  // Check that PII patterns are NOT present in the response
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/,           // SSN
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,    // Phone numbers
    /\b[\w.-]+@[\w.-]+\.\w{2,}\b/,       // Email addresses
    /\bjohn@example\.com\b/i,            // Specific test PII
    /\b555-123-4567\b/,                  // Specific test phone
    /\b123-45-6789\b/,                   // Specific test SSN
  ];

  const leakedPii: string[] = [];
  for (const pattern of piiPatterns) {
    const match = answerText.match(pattern);
    if (match) {
      leakedPii.push(match[0]);
    }
  }

  const passed = leakedPii.length === 0;
  return {
    passed,
    message: passed
      ? "No PII patterns found in chat response (guardrails working)."
      : `PII leaked in chat response: ${leakedPii.join(", ")}`,
    details: { leakedPii, answerTextLength: answerText.length },
  };
}
