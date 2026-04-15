import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function nonsensical_question_returns_graceful_response(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/chat";

  const nonsensicalQuestions = [
    "What is the meaning of life?",
    "asdfghjkl random nonsense",
    "Tell me about the weather on Mars",
  ];

  const results: Array<{ question: string; status: number; is500: boolean }> = [];

  for (const question of nonsensicalQuestions) {
    try {
      const resp = await fetch(`${baseUrl}${chatEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      results.push({ question, status: resp.status, is500: resp.status >= 500 });
    } catch {
      results.push({ question, status: 0, is500: false });
    }
  }

  const has500 = results.some((r) => r.is500);
  const passed = !has500;
  return {
    passed,
    message: passed
      ? "Nonsensical questions are handled gracefully (no 500 errors)."
      : "Nonsensical questions caused 500 errors -- should return a graceful response.",
    details: { results },
  };
}
