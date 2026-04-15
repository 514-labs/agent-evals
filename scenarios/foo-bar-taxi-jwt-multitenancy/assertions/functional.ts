import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function api_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  // Read yellow tenant JWT
  let yellowJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read /data/auth/yellow-tenant.jwt.", details: {} };
  }

  try {
    const resp = await fetch(`${baseUrl}${tripsEndpoint}?limit=1`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const passed = resp.ok;
    return {
      passed,
      message: passed
        ? `API responded with HTTP ${resp.status} at ${tripsEndpoint}.`
        : `API returned HTTP ${resp.status} at ${tripsEndpoint}.`,
      details: { status: resp.status },
    };
  } catch (err) {
    return { passed: false, message: `API request failed: ${String(err)}`, details: {} };
  }
}

export async function jwt_auth_works(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const tripsEndpoint = meta.trips_endpoint || "/trips";

  let yellowJwt: string;
  let greenJwt: string;
  try {
    yellowJwt = readFileSync("/data/auth/yellow-tenant.jwt", "utf8").trim();
    greenJwt = readFileSync("/data/auth/green-tenant.jwt", "utf8").trim();
  } catch {
    return { passed: false, message: "Could not read JWT files from /data/auth/.", details: {} };
  }

  try {
    const yellowResp = await fetch(`${baseUrl}${tripsEndpoint}?limit=1`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const greenResp = await fetch(`${baseUrl}${tripsEndpoint}?limit=1`, {
      headers: { Authorization: `Bearer ${greenJwt}` },
    });
    const passed = yellowResp.ok && greenResp.ok;
    return {
      passed,
      message: passed
        ? "Both yellow and green tenant JWTs authenticate successfully."
        : `Yellow: HTTP ${yellowResp.status}, Green: HTTP ${greenResp.status}.`,
      details: { yellowStatus: yellowResp.status, greenStatus: greenResp.status },
    };
  } catch (err) {
    return { passed: false, message: `JWT auth test failed: ${String(err)}`, details: {} };
  }
}
