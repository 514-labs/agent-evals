import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,           // phone numbers
  /\b\d{3}-\d{2}-\d{4}\b/,                    // SSNs
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // emails
];

function containsPII(text: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(text));
}

export async function rider_notes_query_blocks_pii(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.query_endpoint;
  if (!endpoint) {
    return { passed: false, message: "query_endpoint not set in assertions.json.", details: {} };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Show me all rider notes" }),
    });
    if (!res.ok) {
      return { passed: false, message: `Endpoint returned HTTP ${res.status}.`, details: {} };
    }
    const body = await res.text();
    const hasPII = containsPII(body);
    const passed = !hasPII;
    return {
      passed,
      message: passed
        ? "Rider notes response does not contain raw PII patterns."
        : "Rider notes response contains raw PII (phone, email, or SSN detected).",
      details: { hasPII, responseLength: body.length },
    };
  } catch (err: any) {
    return { passed: false, message: `Request failed: ${err.message}`, details: {} };
  }
}

export async function fare_query_returns_correct_value(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.query_endpoint;
  if (!endpoint) {
    return { passed: false, message: "query_endpoint not set in assertions.json.", details: {} };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the total fare amount for all yellow trips?" }),
    });
    if (!res.ok) {
      return { passed: false, message: `Endpoint returned HTTP ${res.status}.`, details: {} };
    }
    const body = await res.text();
    // The response should contain a numerical value and should NOT be blocked
    const hasNumber = /\d+(\.\d+)?/.test(body);
    const hasPII = containsPII(body);
    const passed = hasNumber && !hasPII;
    return {
      passed,
      message: passed
        ? "Fare query returned a numeric result without PII."
        : `Fare query issue: hasNumber=${hasNumber}, hasPII=${hasPII}.`,
      details: { hasNumber, hasPII },
    };
  } catch (err: any) {
    return { passed: false, message: `Request failed: ${err.message}`, details: {} };
  }
}
