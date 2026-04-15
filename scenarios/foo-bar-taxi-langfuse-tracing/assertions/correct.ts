import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function three_queries_produce_three_traces(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const endpoint = config.agent_endpoint;
  if (!endpoint) {
    return { passed: false, message: "agent_endpoint not set in assertions.json.", details: {} };
  }

  const questions = ["How many trips?", "What is the average fare?", "What is the biggest tip?"];

  for (const question of questions) {
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
    } catch {
      // Agent may be slow; continue
    }
  }

  // Wait for traces to flush
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const host = ctx.env("LANGFUSE_HOST") || "https://cloud.langfuse.com";
  const publicKey = ctx.env("LANGFUSE_PUBLIC_KEY");
  const secretKey = ctx.env("LANGFUSE_SECRET_KEY");

  if (!publicKey || !secretKey) {
    return { passed: false, message: "Langfuse keys not set.", details: {} };
  }

  try {
    const res = await fetch(`${host}/api/public/traces?limit=50`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      return { passed: false, message: `Langfuse API returned HTTP ${res.status}.`, details: {} };
    }
    const body = (await res.json()) as { data?: any[] };
    const traceCount = body.data?.length ?? 0;
    const passed = traceCount >= 3;
    return {
      passed,
      message: passed
        ? `Found ${traceCount} traces after 3 queries.`
        : `Expected >= 3 traces, found ${traceCount}.`,
      details: { traceCount, queriesSent: questions.length },
    };
  } catch (err: any) {
    return { passed: false, message: `Langfuse API error: ${err.message}`, details: {} };
  }
}

export async function traces_have_tool_call_spans(ctx: AssertionContext): Promise<AssertionResult> {
  const host = ctx.env("LANGFUSE_HOST") || "https://cloud.langfuse.com";
  const publicKey = ctx.env("LANGFUSE_PUBLIC_KEY");
  const secretKey = ctx.env("LANGFUSE_SECRET_KEY");

  if (!publicKey || !secretKey) {
    return { passed: false, message: "Langfuse keys not set.", details: {} };
  }

  try {
    const res = await fetch(`${host}/api/public/observations?limit=50&type=SPAN`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      return { passed: false, message: `Langfuse API returned HTTP ${res.status}.`, details: {} };
    }
    const body = (await res.json()) as { data?: any[] };
    const spanCount = body.data?.length ?? 0;
    const passed = spanCount >= 1;
    return {
      passed,
      message: passed
        ? `Found ${spanCount} span observation(s) in Langfuse.`
        : "No span observations found in Langfuse traces.",
      details: { spanCount },
    };
  } catch (err: any) {
    return { passed: false, message: `Langfuse API error: ${err.message}`, details: {} };
  }
}
