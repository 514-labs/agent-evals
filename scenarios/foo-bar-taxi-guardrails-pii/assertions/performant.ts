import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function query_response_under_3s(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.query_endpoint;
  if (!endpoint) {
    return { passed: false, message: "query_endpoint not set in assertions.json.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the average fare amount?" }),
    });
    const elapsed = Date.now() - start;
    const passed = res.ok && elapsed < 3000;
    return {
      passed,
      message: passed
        ? `Query responded in ${elapsed}ms (< 3s).`
        : `Query took ${elapsed}ms or failed (HTTP ${res.status}).`,
      details: { elapsedMs: elapsed, status: res.status },
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    return {
      passed: false,
      message: `Endpoint unreachable after ${elapsed}ms: ${err.message}`,
      details: { elapsedMs: elapsed },
    };
  }
}
