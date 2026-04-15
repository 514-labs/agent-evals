import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function rejected_table_has_rejection_reason_column(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.rejected_table_name;
  if (!tableName) {
    return { passed: false, message: "rejected_table_name not set in assertions.json.", details: {} };
  }

  const parts = tableName.includes(".") ? tableName.split(".") : ["default", tableName];
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.columns WHERE database = '${parts[0]}' AND table = '${parts[1]}' AND name = 'rejection_reason'`,
  );
  const passed = rows.length === 1;
  return {
    passed,
    message: passed ? "rejection_reason column exists in rejected table." : "rejection_reason column missing from rejected table.",
    details: { tableName, columnCount: rows.length },
  };
}

export async function no_negative_fares_in_valid_table(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.valid_table_name;
  if (!tableName) {
    return { passed: false, message: "valid_table_name not set in assertions.json.", details: {} };
  }

  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${tableName} WHERE fare_amount < 0`,
  );
  const negativeCount = Number(rows[0]?.n ?? 0);
  const passed = negativeCount === 0;
  return {
    passed,
    message: passed ? "No negative fares in valid table." : `Found ${negativeCount} rows with negative fare in valid table.`,
    details: { negativeCount },
  };
}

export async function valid_plus_rejected_approximates_source(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const validTable = config.valid_table_name;
  const rejectedTable = config.rejected_table_name;
  if (!validTable || !rejectedTable) {
    return { passed: false, message: "Table names not set in assertions.json.", details: {} };
  }

  const validRows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${validTable}`);
  const rejectedRows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${rejectedTable}`);
  const validCount = Number(validRows[0]?.n ?? 0);
  const rejectedCount = Number(rejectedRows[0]?.n ?? 0);
  const totalPipelineRows = validCount + rejectedCount;

  // The yellow dataset alone has ~3M rows; yellow+green should be ~3.1M.
  // Allow a reasonable range: total should be > 2.5M (at least most rows accounted for).
  const passed = totalPipelineRows > 2500000;
  return {
    passed,
    message: passed
      ? `Valid (${validCount}) + rejected (${rejectedCount}) = ${totalPipelineRows} rows, covers source data.`
      : `Valid (${validCount}) + rejected (${rejectedCount}) = ${totalPipelineRows}, expected >2.5M total.`,
    details: { validCount, rejectedCount, totalPipelineRows },
  };
}

export async function rejected_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.rejected_table_name;
  if (!tableName) {
    return { passed: false, message: "rejected_table_name not set in assertions.json.", details: {} };
  }

  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${tableName}`);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? `Rejected table has ${count} rows.` : "Rejected table is empty -- expected some rejected rows.",
    details: { count },
  };
}
