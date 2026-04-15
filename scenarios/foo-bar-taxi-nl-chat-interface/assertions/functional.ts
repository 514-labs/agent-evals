import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function chat_endpoint_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/chat";

  try {
    const resp = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips were there?" }),
    });
    const passed = resp.ok;
    return {
      passed,
      message: passed
        ? `Chat endpoint responded with HTTP ${resp.status}.`
        : `Chat endpoint returned HTTP ${resp.status}.`,
      details: { status: resp.status },
    };
  } catch (err) {
    return { passed: false, message: `Chat endpoint request failed: ${String(err)}`, details: {} };
  }
}
