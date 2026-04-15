import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync, existsSync } from "node:fs";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function no_data_loss_fare_amount_sum(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set.", details: {} };
  }

  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  // Read pre-migration ground truth
  let groundTruth: number | null = null;
  if (existsSync("/tmp/jan_fare_sum_ground_truth.txt")) {
    const raw = readFileSync("/tmp/jan_fare_sum_ground_truth.txt", "utf8").trim();
    groundTruth = parseFloat(raw);
  }

  // Get current fare sum for January rows
  const rows = await queryRows<{ fare_sum: number }>(
    ctx,
    `SELECT round(sum(fare_amount), 2) AS fare_sum FROM ${db}.${table}
     WHERE toMonth(tpep_pickup_datetime) = 1 AND toYear(tpep_pickup_datetime) = 2024`,
  );
  const currentSum = Number(rows[0]?.fare_sum ?? 0);

  if (groundTruth === null || isNaN(groundTruth)) {
    // If ground truth file is missing, just verify sum is reasonable (> $10M for 3M trips)
    const passed = currentSum > 10_000_000;
    return {
      passed,
      message: passed
        ? `January fare sum is $${currentSum} (ground truth file missing, but value looks reasonable).`
        : `January fare sum is $${currentSum} (suspiciously low).`,
      details: { currentSum, groundTruth: "missing" },
    };
  }

  // Allow 0.01% tolerance for floating point
  const tolerance = groundTruth * 0.0001;
  const passed = Math.abs(currentSum - groundTruth) <= tolerance;
  return {
    passed,
    message: passed
      ? `January fare sum matches ground truth ($${currentSum} vs $${groundTruth}).`
      : `January fare sum mismatch: $${currentSum} vs ground truth $${groundTruth}.`,
    details: { currentSum, groundTruth, tolerance },
  };
}
