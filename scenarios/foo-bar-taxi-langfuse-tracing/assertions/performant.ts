import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function agent_responds_under_5s(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.agent_endpoint;
  if (!endpoint) {
    return { passed: false, message: "agent_endpoint not set in assertions.json.", details: {} };
  }

  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips?" }),
    });
    const elapsed = Date.now() - start;
    const passed = res.ok && elapsed < 5000;
    return {
      passed,
      message: passed
        ? `Agent responded in ${elapsed}ms (< 5s).`
        : `Agent response took ${elapsed}ms or failed (HTTP ${res.status}).`,
      details: { elapsedMs: elapsed, status: res.status },
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    return {
      passed: false,
      message: `Agent unreachable after ${elapsed}ms: ${err.message}`,
      details: { elapsedMs: elapsed },
    };
  }
}
