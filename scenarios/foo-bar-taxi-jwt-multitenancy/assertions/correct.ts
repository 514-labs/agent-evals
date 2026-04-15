import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function yellow_token_returns_only_yellow_trips(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read yellow-tenant.jwt.", details: {} };
  }

  try {
    const summaryResp = await fetch(`${baseUrl}${tripsEndpoint}/summary`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    if (!summaryResp.ok) {
      // Try alternative endpoint pattern
      const altResp = await fetch(`${baseUrl}${tripsEndpoint}?limit=5`, {
        headers: { Authorization: `Bearer ${yellowJwt}` },
      });
      if (!altResp.ok) {
        return { passed: false, message: `Summary endpoint returned HTTP ${summaryResp.status}.`, details: {} };
      }
      const data = await altResp.json() as any;
      const rows = Array.isArray(data) ? data : (data.data || data.trips || data.rows || []);
      const allYellow = rows.every((r: any) => r.taxi_type === "yellow");
      return {
        passed: allYellow && rows.length > 0,
        message: allYellow
          ? "Yellow token returns only yellow trips."
          : "Yellow token returned non-yellow trips -- cross-tenant leakage detected.",
        details: { sampleSize: rows.length, allYellow },
      };
    }

    const summary = await summaryResp.json() as any;
    const totalTrips = summary.total_trips || summary.totalTrips || summary.count || 0;
    const expected = 2964624;
    const tolerance = expected * 0.05;
    const passed = Math.abs(totalTrips - expected) <= tolerance;
    return {
      passed,
      message: passed
        ? `Yellow token summary shows ${totalTrips} trips (within 5% of ${expected}).`
        : `Yellow token summary shows ${totalTrips} trips (expected ~${expected}).`,
      details: { totalTrips, expected, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function green_token_returns_only_green_trips(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  let greenJwt: string;
  try {
    greenJwt = readFileSync("/data/auth/green-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read green-tenant.jwt.", details: {} };
  }

  try {
    const summaryResp = await fetch(`${baseUrl}${tripsEndpoint}/summary`, {
      headers: { Authorization: `Bearer ${greenJwt}` },
    });
    if (!summaryResp.ok) {
      const altResp = await fetch(`${baseUrl}${tripsEndpoint}?limit=5`, {
        headers: { Authorization: `Bearer ${greenJwt}` },
      });
      if (!altResp.ok) {
        return { passed: false, message: `Endpoint returned HTTP ${summaryResp.status}.`, details: {} };
      }
      const data = await altResp.json() as any;
      const rows = Array.isArray(data) ? data : (data.data || data.trips || data.rows || []);
      const allGreen = rows.every((r: any) => r.taxi_type === "green");
      return {
        passed: allGreen && rows.length > 0,
        message: allGreen
          ? "Green token returns only green trips."
          : "Green token returned non-green trips -- cross-tenant leakage detected.",
        details: { sampleSize: rows.length, allGreen },
      };
    }

    const summary = await summaryResp.json() as any;
    const totalTrips = summary.total_trips || summary.totalTrips || summary.count || 0;
    const expected = 85046;
    const tolerance = expected * 0.05;
    const passed = Math.abs(totalTrips - expected) <= tolerance;
    return {
      passed,
      message: passed
        ? `Green token summary shows ${totalTrips} trips (within 5% of ${expected}).`
        : `Green token summary shows ${totalTrips} trips (expected ~${expected}).`,
      details: { totalTrips, expected, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function no_cross_tenant_leakage(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read yellow-tenant.jwt.", details: {} };
  }

  try {
    const resp = await fetch(`${baseUrl}${tripsEndpoint}?limit=100`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    if (!resp.ok) {
      return { passed: false, message: `Trips endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const rows = Array.isArray(data) ? data : (data.data || data.trips || data.rows || []);
    const greenRows = rows.filter((r: any) => r.taxi_type === "green");
    const passed = greenRows.length === 0 && rows.length > 0;
    return {
      passed,
      message: passed
        ? "Yellow token returned 0 green trips -- no cross-tenant leakage."
        : `Yellow token returned ${greenRows.length} green trips out of ${rows.length} -- leakage detected.`,
      details: { totalRows: rows.length, greenRows: greenRows.length },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
