import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

function extractNumericAnswer(data: any): number {
  // Try various response shapes the agent might use
  if (typeof data.answer === "number") return data.answer;
  if (typeof data.result === "number") return data.result;
  if (typeof data.value === "number") return data.value;
  if (typeof data.answer === "string") {
    const num = parseFloat(data.answer.replace(/[,$]/g, ""));
    if (!isNaN(num)) return num;
  }
  if (typeof data.result === "string") {
    const num = parseFloat(data.result.replace(/[,$]/g, ""));
    if (!isNaN(num)) return num;
  }
  return NaN;
}

export async function trip_count_within_tolerance(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/chat";

  try {
    const resp = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips were there?" }),
    });
    if (!resp.ok) {
      return { passed: false, message: `Chat endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const answer = extractNumericAnswer(data);
    const expected = 3000000;
    const tolerancePct = 5;
    const tolerance = expected * (tolerancePct / 100);
    const passed = !isNaN(answer) && Math.abs(answer - expected) <= tolerance;
    return {
      passed,
      message: passed
        ? `Trip count answer ${answer} is within ${tolerancePct}% of expected ${expected}.`
        : `Trip count answer ${answer} is outside ${tolerancePct}% tolerance of expected ${expected}.`,
      details: { answer, expected, tolerancePct },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function total_revenue_within_tolerance(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = "http://localhost:3000";
  const chatEndpoint = meta.chat_endpoint || "/chat";

  try {
    const resp = await fetch(`${baseUrl}${chatEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What was the total revenue?" }),
    });
    if (!resp.ok) {
      return { passed: false, message: `Chat endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const answer = extractNumericAnswer(data);
    const expected = 55000000;
    const tolerancePct = 5;
    const tolerance = expected * (tolerancePct / 100);
    const passed = !isNaN(answer) && Math.abs(answer - expected) <= tolerance;
    return {
      passed,
      message: passed
        ? `Total revenue answer ${answer} is within ${tolerancePct}% of expected ${expected}.`
        : `Total revenue answer ${answer} is outside ${tolerancePct}% tolerance of expected ${expected}.`,
      details: { answer, expected, tolerancePct },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
