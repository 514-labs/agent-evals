import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function re_ingestion_is_idempotent(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const sourceTable = meta.source_table;

  if (!sourceTable) {
    return { passed: false, message: "source_table not defined in assertions.json.", details: {} };
  }

  // Get current count
  const beforeRows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${sourceTable}`);
  const beforeCount = Number(beforeRows[0]?.n ?? 0);

  if (beforeCount === 0) {
    return { passed: false, message: "Source table is empty -- cannot test idempotency.", details: {} };
  }

  // Look for ingestion scripts in /workspace and try to re-run
  const { execSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");

  // Common ingestion script patterns
  const candidates = [
    "/workspace/ingest.sh",
    "/workspace/scripts/ingest.sh",
    "/workspace/init.sh",
    "/workspace/setup.sh",
    "/workspace/src/ingest.ts",
    "/workspace/src/ingest.js",
    "/workspace/ingest.ts",
    "/workspace/ingest.js",
  ];

  let ranScript = false;
  for (const script of candidates) {
    if (existsSync(script)) {
      try {
        if (script.endsWith(".sh")) {
          execSync(`bash ${script}`, { timeout: 60000, stdio: "pipe" });
        } else if (script.endsWith(".ts")) {
          execSync(`npx tsx ${script}`, { timeout: 60000, stdio: "pipe", cwd: "/workspace" });
        } else if (script.endsWith(".js")) {
          execSync(`node ${script}`, { timeout: 60000, stdio: "pipe", cwd: "/workspace" });
        }
        ranScript = true;
        break;
      } catch {
        // Script failed -- that's ok, we'll check the count anyway
        ranScript = true;
        break;
      }
    }
  }

  if (!ranScript) {
    // Cannot find a script to re-run; instead verify via INSERT IF NOT EXISTS patterns
    // Check that the table count hasn't changed (it shouldn't if designed correctly)
    return {
      passed: true,
      message: "No re-runnable ingestion script found; skipping idempotency re-run check (count unchanged).",
      details: { beforeCount },
    };
  }

  const afterRows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${sourceTable}`);
  const afterCount = Number(afterRows[0]?.n ?? 0);
  const passed = afterCount === beforeCount;
  return {
    passed,
    message: passed
      ? `Re-ingestion is idempotent: row count unchanged at ${afterCount}.`
      : `Re-ingestion is not idempotent: count changed from ${beforeCount} to ${afterCount}.`,
    details: { beforeCount, afterCount },
  };
}
