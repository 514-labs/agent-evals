import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function query_endpoint_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.query_endpoint;
  if (!endpoint) {
    return { passed: false, message: "query_endpoint not set in assertions.json.", details: { config } };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the total fare amount?" }),
    });
    const passed = res.ok;
    return {
      passed,
      message: passed ? "Query endpoint responded with HTTP 200." : `Endpoint returned HTTP ${res.status}.`,
      details: { status: res.status },
    };
  } catch (err: any) {
    return { passed: false, message: `Endpoint unreachable: ${err.message}`, details: {} };
  }
}
