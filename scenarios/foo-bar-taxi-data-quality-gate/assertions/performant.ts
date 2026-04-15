import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function valid_table_query_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.valid_table_name;
  if (!tableName) {
    return { passed: false, message: "valid_table_name not set in assertions.json.", details: {} };
  }

  const start = Date.now();
  await queryRows(ctx, `SELECT count() AS n FROM ${tableName}`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? `Count query on valid table took ${elapsed}ms.` : `Count query on valid table took ${elapsed}ms (limit 500ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function pipeline_loaded_over_2m_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const validTable = config.valid_table_name;
  const rejectedTable = config.rejected_table_name;
  if (!validTable || !rejectedTable) {
    return { passed: false, message: "Table names not set in assertions.json.", details: {} };
  }

  const validRows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${validTable}`);
  const rejectedRows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${rejectedTable}`);
  const total = Number(validRows[0]?.n ?? 0) + Number(rejectedRows[0]?.n ?? 0);
  const passed = total > 2000000;
  return {
    passed,
    message: passed
      ? `Pipeline processed ${total} rows total.`
      : `Pipeline only processed ${total} rows, expected >2M.`,
    details: { total },
  };
}
