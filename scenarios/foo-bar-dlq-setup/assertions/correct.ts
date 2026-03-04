import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync, existsSync } from "node:fs";

export async function dlq_table_has_required_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const existsResult = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'dlq_events'",
    format: "JSONEachRow",
  });
  const existsRows = (await (existsResult as any).json()) as Array<{ n: number }>;
  if (Number(existsRows[0]?.n ?? 0) === 0) {
    return { passed: false, message: "DLQ events table does not exist.", details: {} };
  }
  const result = await ctx.clickhouse.query({
    query: "DESCRIBE TABLE analytics.dlq_events",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ name: string }>;
  const names = rows.map((r) => r.name.toLowerCase());
  const hasRaw = names.some((n) => n.includes("raw") || n.includes("payload"));
  const hasError = names.some((n) => n.includes("error"));
  const hasTs = names.some((n) => n.includes("ts") || n.includes("timestamp"));
  const passed = hasRaw && hasError && hasTs;
  return {
    passed,
    message: passed ? "DLQ table has required columns." : `Missing columns. Got: ${JSON.stringify(names)}.`,
    details: { names, hasRaw, hasError, hasTs },
  };
}

export async function consumer_references_dlq_topic(): Promise<AssertionResult> {
  const paths = ["/workspace/consumer.py", "/workspace/consumer.js"];
  let found = false;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, "utf8");
      const hasDlq = content.includes("dlq") || content.includes("events-dlq") || content.includes("dead");
      if (hasDlq) {
        found = true;
        break;
      }
    } catch {
      continue;
    }
  }
  return {
    passed: found,
    message: found ? "Consumer references DLQ topic." : "Consumer does not reference DLQ topic.",
    details: { found },
  };
}
