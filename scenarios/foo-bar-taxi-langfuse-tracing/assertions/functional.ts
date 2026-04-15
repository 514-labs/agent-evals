import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function agent_endpoint_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.agent_endpoint;
  if (!endpoint) {
    return { passed: false, message: "agent_endpoint not set in assertions.json.", details: { config } };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How many trips?" }),
    });
    const passed = res.ok;
    return {
      passed,
      message: passed ? "Agent endpoint responded with HTTP 200." : `Agent returned HTTP ${res.status}.`,
      details: { status: res.status },
    };
  } catch (err: any) {
    return { passed: false, message: `Agent endpoint unreachable: ${err.message}`, details: {} };
  }
}

export async function langfuse_has_traces(ctx: AssertionContext): Promise<AssertionResult> {
  const host = ctx.env("LANGFUSE_HOST") || "https://cloud.langfuse.com";
  const publicKey = ctx.env("LANGFUSE_PUBLIC_KEY");
  const secretKey = ctx.env("LANGFUSE_SECRET_KEY");

  if (!publicKey || !secretKey) {
    return { passed: false, message: "LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY not set.", details: {} };
  }

  try {
    const res = await fetch(`${host}/api/public/traces?limit=10`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      return { passed: false, message: `Langfuse API returned HTTP ${res.status}.`, details: {} };
    }
    const body = (await res.json()) as { data?: any[] };
    const traceCount = body.data?.length ?? 0;
    const passed = traceCount >= 1;
    return {
      passed,
      message: passed ? `Found ${traceCount} trace(s) in Langfuse.` : "No traces found in Langfuse.",
      details: { traceCount },
    };
  } catch (err: any) {
    return { passed: false, message: `Langfuse API error: ${err.message}`, details: {} };
  }
}
