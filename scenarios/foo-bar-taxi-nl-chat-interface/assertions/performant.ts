import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function response_under_5s(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/chat";

  try {
    const start = Date.now();
    const resp = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips were there?" }),
    });
    await resp.json();
    const elapsed = Date.now() - start;

    if (!resp.ok) {
      return { passed: false, message: `Chat endpoint returned HTTP ${resp.status}.`, details: { status: resp.status } };
    }

    const passed = elapsed < 5000;
    return {
      passed,
      message: passed
        ? `Chat response completed in ${elapsed}ms (< 5000ms).`
        : `Chat response took ${elapsed}ms (expected < 5000ms including LLM + query time).`,
      details: { elapsedMs: elapsed },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
