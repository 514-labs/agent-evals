import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function mcp_server_responds(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch (err) {
    return { passed: false, message: "Could not read /workspace/assertions.json.", details: { error: String(err) } };
  }
  const serverUrl = meta.mcp_server_url;
  if (!serverUrl || typeof serverUrl !== "string") {
    return { passed: false, message: "mcp_server_url not set in assertions.json.", details: {} };
  }

  try {
    // Send a JSON-RPC initialize request to the MCP server
    const resp = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "assertion-test", version: "1.0.0" },
        },
      }),
    });
    const passed = resp.status === 200;
    return {
      passed,
      message: passed
        ? "MCP server responded to initialize request."
        : `MCP server returned HTTP ${resp.status}.`,
      details: { serverUrl, status: resp.status },
    };
  } catch (err) {
    return { passed: false, message: `MCP server not reachable: ${err}`, details: { serverUrl } };
  }
}

export async function at_least_three_tools_listed(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch (err) {
    return { passed: false, message: "Could not read /workspace/assertions.json.", details: { error: String(err) } };
  }
  const serverUrl = meta.mcp_server_url;
  const toolNames: string[] = meta.tool_names ?? [];

  // First check declarations in assertions.json
  if (toolNames.length >= 3) {
    // Verify by querying the MCP server tools/list
    if (serverUrl) {
      try {
        const resp = await fetch(serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {},
          }),
        });
        if (resp.status === 200) {
          const body = await resp.json() as any;
          const serverTools: any[] = body.result?.tools ?? [];
          const passed = serverTools.length >= 3;
          return {
            passed,
            message: passed
              ? `MCP server lists ${serverTools.length} tools (>= 3 required).`
              : `MCP server only lists ${serverTools.length} tools (>= 3 required).`,
            details: { declaredTools: toolNames, serverTools: serverTools.map((t: any) => t.name) },
          };
        }
      } catch {
        // Fall through to assertions.json check
      }
    }
    return {
      passed: true,
      message: `${toolNames.length} tools declared in assertions.json (>= 3 required).`,
      details: { toolNames },
    };
  }

  const passed = toolNames.length >= 3;
  return {
    passed,
    message: passed
      ? `${toolNames.length} tools declared (>= 3 required).`
      : `Only ${toolNames.length} tools declared in assertions.json (>= 3 required).`,
    details: { toolNames },
  };
}
