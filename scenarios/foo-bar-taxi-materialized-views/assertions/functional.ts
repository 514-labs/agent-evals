import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function mv_target_tables_exist(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];
  if (targetTables.length < 3) {
    return {
      passed: false,
      message: `Expected at least 3 target tables, got ${targetTables.length}.`,
      details: { targetTables },
    };
  }

  const missing: string[] = [];
  for (const table of targetTables) {
    const parts = table.includes(".") ? table.split(".") : ["default", table];
    const rows = await queryRows<{ n: number }>(
      ctx,
      `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}'`,
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      missing.push(table);
    }
  }

  const passed = missing.length === 0;
  return {
    passed,
    message: passed ? "All MV target tables exist." : `Missing tables: ${missing.join(", ")}.`,
    details: { targetTables, missing },
  };
}

export async function materialized_views_exist(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const mvNames = config.mv_names || [];
  if (mvNames.length < 3) {
    return {
      passed: false,
      message: `Expected at least 3 materialized views, got ${mvNames.length}.`,
      details: { mvNames },
    };
  }

  const missing: string[] = [];
  for (const mv of mvNames) {
    const parts = mv.includes(".") ? mv.split(".") : ["default", mv];
    const rows = await queryRows<{ n: number }>(
      ctx,
      `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}' AND engine = 'MaterializedView'`,
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      missing.push(mv);
    }
  }

  const passed = missing.length === 0;
  return {
    passed,
    message: passed ? "All materialized views exist." : `Missing MVs: ${missing.join(", ")}.`,
    details: { mvNames, missing },
  };
}

export async function target_tables_have_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];
  const empty: string[] = [];

  for (const table of targetTables) {
    const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${table}`);
    if (Number(rows[0]?.n ?? 0) === 0) {
      empty.push(table);
    }
  }

  const passed = empty.length === 0 && targetTables.length >= 3;
  return {
    passed,
    message: passed ? "All target tables have rows." : `Empty tables: ${empty.join(", ")}.`,
    details: { targetTables, empty },
  };
}
