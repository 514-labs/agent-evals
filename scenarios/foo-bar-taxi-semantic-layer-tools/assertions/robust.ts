import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function invalid_params_returns_error_not_crash(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const serverUrl = meta.mcp_server_url;
  const toolNames: string[] = meta.tool_names ?? [];

  if (!serverUrl) {
    return { passed: false, message: "mcp_server_url not set.", details: {} };
  }

  if (toolNames.length === 0) {
    return { passed: false, message: "No tools declared in assertions.json.", details: {} };
  }

  // Call the first tool with clearly invalid parameters
  const toolName = toolNames[0];
  try {
    const resp = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: {
            taxi_type: "INVALID_TYPE_XYZ",
            start_date: "not-a-date",
            end_date: "also-not-a-date",
          },
        },
      }),
    });

    const status = resp.status;
    const body = await resp.json() as any;

    // MCP protocol: errors should come back as isError in the result or as a JSON-RPC error
    const hasError = body.error != null || body.result?.isError === true;
    const serverStillUp = status === 200 || status === 400;
    const passed = serverStillUp && hasError;

    return {
      passed,
      message: passed
        ? "Invalid parameters returned a structured error without crashing the server."
        : `Expected structured error response. HTTP ${status}, hasError=${hasError}.`,
      details: { status, hasError, body },
    };
  } catch (err) {
    // If the server crashed and is no longer reachable, that is a failure
    return {
      passed: false,
      message: `MCP server appears to have crashed on invalid params: ${err}`,
      details: { toolName },
    };
  }
}
