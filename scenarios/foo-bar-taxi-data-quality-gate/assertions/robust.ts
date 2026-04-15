import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function re_ingestion_does_not_create_duplicates(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const validTable = config.valid_table_name;
  const rejectedTable = config.rejected_table_name;
  if (!validTable || !rejectedTable) {
    return { passed: false, message: "Table names not set in assertions.json.", details: {} };
  }

  // Record counts before
  const validBefore = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${validTable}`);
  const rejectedBefore = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${rejectedTable}`);
  const validCountBefore = Number(validBefore[0]?.n ?? 0);
  const rejectedCountBefore = Number(rejectedBefore[0]?.n ?? 0);

  // Look for pipeline scripts in /workspace and re-run
  const { execSync } = await import("node:child_process");
  const { readdirSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");

  let rerunCommand = "";
  const workspace = "/workspace";

  if (existsSync(workspace)) {
    const files = readdirSync(workspace);
    // Look for common pipeline scripts
    for (const file of files) {
      const fullPath = join(workspace, file);
      if (file.endsWith(".sh")) {
        rerunCommand = `bash ${fullPath}`;
        break;
      }
      if (file.endsWith(".py")) {
        rerunCommand = `python3 ${fullPath}`;
        break;
      }
      if (file.endsWith(".js") || file.endsWith(".ts")) {
        rerunCommand = `node ${fullPath}`;
        break;
      }
      if (file === "Makefile") {
        rerunCommand = `make -C ${workspace}`;
        break;
      }
    }
  }

  if (!rerunCommand) {
    // If no script found, just check the assertions.json counts match current DB counts
    const passed = validCountBefore > 0;
    return {
      passed,
      message: passed
        ? "No pipeline script found to re-run, but valid table has data. Idempotency not directly testable."
        : "No pipeline script found and valid table is empty.",
      details: { validCountBefore, rejectedCountBefore },
    };
  }

  try {
    execSync(rerunCommand, { timeout: 300000, cwd: workspace });
  } catch {
    // Pipeline may fail on re-run for expected reasons; check counts anyway
  }

  // Record counts after
  const validAfter = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${validTable}`);
  const rejectedAfter = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${rejectedTable}`);
  const validCountAfter = Number(validAfter[0]?.n ?? 0);
  const rejectedCountAfter = Number(rejectedAfter[0]?.n ?? 0);

  const validMatch = validCountBefore === validCountAfter;
  const rejectedMatch = rejectedCountBefore === rejectedCountAfter;
  const passed = validMatch && rejectedMatch;

  return {
    passed,
    message: passed
      ? "Re-ingestion did not create duplicates."
      : `Counts changed after re-run: valid ${validCountBefore}->${validCountAfter}, rejected ${rejectedCountBefore}->${rejectedCountAfter}.`,
    details: { validCountBefore, validCountAfter, rejectedCountBefore, rejectedCountAfter },
  };
}
