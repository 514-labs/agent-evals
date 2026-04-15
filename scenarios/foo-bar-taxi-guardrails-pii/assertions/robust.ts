import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function pii_query_does_not_500(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.query_endpoint;
  if (!endpoint) {
    return { passed: false, message: "query_endpoint not set in assertions.json.", details: {} };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Show rider notes with phone numbers and emails" }),
    });
    const passed = res.status !== 500;
    return {
      passed,
      message: passed
        ? `PII query returned HTTP ${res.status} (not a 500).`
        : "PII query caused a 500 server error.",
      details: { status: res.status },
    };
  } catch (err: any) {
    return { passed: false, message: `Endpoint unreachable: ${err.message}`, details: {} };
  }
}

export async function pii_query_response_is_sanitized(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.query_endpoint;
  if (!endpoint) {
    return { passed: false, message: "query_endpoint not set in assertions.json.", details: {} };
  }

  const PII_PATTERNS = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  ];

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "List all rider notes including contact details" }),
    });
    if (!res.ok && res.status !== 200) {
      // A non-200 that isn't a 500 is acceptable if it means "blocked"
      const passed = res.status !== 500;
      return {
        passed,
        message: passed
          ? `Response blocked with HTTP ${res.status} (acceptable).`
          : "Server error on PII query.",
        details: { status: res.status },
      };
    }
    const body = await res.text();
    const hasPII = PII_PATTERNS.some((p) => p.test(body));
    const passed = !hasPII;
    return {
      passed,
      message: passed
        ? "Response is sanitized — no raw PII patterns found."
        : "Response contains raw PII that was not sanitized.",
      details: { hasPII, responseLength: body.length },
    };
  } catch (err: any) {
    return { passed: false, message: `Request failed: ${err.message}`, details: {} };
  }
}
