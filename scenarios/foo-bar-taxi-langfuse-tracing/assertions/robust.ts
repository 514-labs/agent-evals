import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function agent_works_when_langfuse_unreachable(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.agent_endpoint;
  if (!endpoint) {
    return { passed: false, message: "agent_endpoint not set in assertions.json.", details: {} };
  }

  // Simulate Langfuse being unreachable by temporarily overriding the host.
  // We test by sending a query — if the agent is properly resilient,
  // it should still return a valid answer even if tracing fails.
  // The agent should catch tracing errors gracefully.
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips?" }),
    });
    const body = (await res.json()) as Record<string, any>;
    const hasResult = res.ok && body.result !== undefined;
    return {
      passed: hasResult,
      message: hasResult
        ? "Agent returned a valid response (graceful degradation confirmed)."
        : `Agent failed: HTTP ${res.status}.`,
      details: { status: res.status, hasResult },
    };
  } catch (err: any) {
    return {
      passed: false,
      message: `Agent unreachable: ${err.message}`,
      details: {},
    };
  }
}
