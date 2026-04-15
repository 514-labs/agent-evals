import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function filtered_query_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
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
    const start = Date.now();
    const resp = await fetch(`${baseUrl}${tripsEndpoint}?limit=50`, {
      headers: { Authorization: `Bearer ${yellowJwt}` },
    });
    const elapsed = Date.now() - start;
    if (!resp.ok) {
      return { passed: false, message: `Endpoint returned HTTP ${resp.status}.`, details: { status: resp.status } };
    }
    // Consume the body
    await resp.json();
    const passed = elapsed < 500;
    return {
      passed,
      message: passed
        ? `Filtered query completed in ${elapsed}ms (< 500ms).`
        : `Filtered query took ${elapsed}ms (expected < 500ms).`,
      details: { elapsedMs: elapsed },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
