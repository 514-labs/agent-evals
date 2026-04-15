import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function tool_calls_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const serverUrl = meta.mcp_server_url;
  const toolNames: string[] = meta.tool_names ?? [];

  if (!serverUrl) {
    return { passed: false, message: "mcp_server_url not set.", details: {} };
  }

  if (toolNames.length === 0) {
    return { passed: false, message: "No tools declared in assertions.json.", details: {} };
  }

  const timings: Array<{ tool: string; elapsedMs: number }> = [];
  for (const toolName of toolNames.slice(0, 5)) {
    try {
      const start = Date.now();
      await fetch(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 30,
          method: "tools/call",
          params: { name: toolName, arguments: {} },
        }),
      });
      const elapsed = Date.now() - start;
      timings.push({ tool: toolName, elapsedMs: elapsed });
    } catch {
      // skip unreachable tools for timing
    }
  }

  const allUnder500 = timings.length > 0 && timings.every((t) => t.elapsedMs < 500);
  const passed = allUnder500;
  return {
    passed,
    message: passed
      ? `All ${timings.length} tested tool calls completed under 500ms.`
      : `Some tool calls exceeded 500ms.`,
    details: { timings },
  };
}
