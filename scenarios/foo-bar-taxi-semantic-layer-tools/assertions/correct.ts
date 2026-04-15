import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function callMcpTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, any>,
): Promise<any> {
  const resp = await fetch(serverUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
  return resp.json();
}

export async function total_revenue_tool_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const serverUrl = meta.mcp_server_url;
  const toolNames: string[] = meta.tool_names ?? [];

  if (!serverUrl) {
    return { passed: false, message: "mcp_server_url not set.", details: {} };
  }

  // Compute ground truth from raw tables
  const rawRows = await queryRows<{ total: number }>(
    ctx,
    "SELECT sum(total_amount) AS total FROM raw.yellow_trips_2024_01",
  );
  const groundTruth = Number(rawRows[0]?.total ?? 0);

  // Find the revenue tool
  const revenueTool = toolNames.find(
    (t) => t.includes("total_revenue") || t.includes("revenue"),
  );
  if (!revenueTool) {
    return { passed: false, message: "No revenue tool found in tool_names.", details: { toolNames } };
  }

  try {
    const body = await callMcpTool(serverUrl, revenueTool, {});
    // Extract value from MCP response -- handle various response shapes
    const content = body.result?.content ?? [];
    let toolValue = 0;
    for (const item of content) {
      if (item.type === "text") {
        try {
          const parsed = JSON.parse(item.text);
          toolValue = Number(parsed.value ?? parsed.total_revenue ?? parsed.result ?? 0);
        } catch {
          toolValue = Number(item.text) || 0;
        }
        break;
      }
    }

    const tolerance = groundTruth * 0.01;
    const passed = Math.abs(toolValue - groundTruth) <= tolerance;
    return {
      passed,
      message: passed
        ? `total_revenue tool value ${toolValue} matches ground truth ${groundTruth} (within 1%).`
        : `total_revenue tool value ${toolValue} does not match ground truth ${groundTruth} (outside 1% tolerance).`,
      details: { toolValue, groundTruth, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Failed to call revenue tool: ${err}`, details: {} };
  }
}

export async function avg_fare_with_yellow_filter_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const serverUrl = meta.mcp_server_url;
  const toolNames: string[] = meta.tool_names ?? [];

  if (!serverUrl) {
    return { passed: false, message: "mcp_server_url not set.", details: {} };
  }

  // Compute ground truth
  const rawRows = await queryRows<{ avg_fare: number }>(
    ctx,
    "SELECT avg(fare_amount) AS avg_fare FROM raw.yellow_trips_2024_01",
  );
  const groundTruth = Number(rawRows[0]?.avg_fare ?? 0);

  // Find the avg_fare tool
  const fareTool = toolNames.find(
    (t) => t.includes("avg_fare") || t.includes("average_fare"),
  );
  if (!fareTool) {
    return { passed: false, message: "No avg_fare tool found in tool_names.", details: { toolNames } };
  }

  try {
    const body = await callMcpTool(serverUrl, fareTool, { taxi_type: "yellow" });
    const content = body.result?.content ?? [];
    let toolValue = 0;
    for (const item of content) {
      if (item.type === "text") {
        try {
          const parsed = JSON.parse(item.text);
          toolValue = Number(parsed.value ?? parsed.avg_fare ?? parsed.result ?? 0);
        } catch {
          toolValue = Number(item.text) || 0;
        }
        break;
      }
    }

    const tolerance = groundTruth * 0.05;
    const passed = Math.abs(toolValue - groundTruth) <= tolerance;
    return {
      passed,
      message: passed
        ? `avg_fare (yellow) tool value ${toolValue} matches ground truth ${groundTruth} (within 5%).`
        : `avg_fare (yellow) tool value ${toolValue} does not match ground truth ${groundTruth} (outside 5% tolerance).`,
      details: { toolValue, groundTruth, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Failed to call avg_fare tool: ${err}`, details: {} };
  }
}
