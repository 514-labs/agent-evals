import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findTable, type TableRef } from "../../_shared/assertion-helpers";

interface ClickHouseJsonEnvelope {
  meta: Array<{ name: string; type: string }>;
  data: unknown[];
  rows: number;
  statistics?: {
    elapsed?: number;
    rows_read?: number;
    bytes_read?: number;
  };
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function queryEnvelope(
  ctx: AssertionContext,
  sql: string,
): Promise<ClickHouseJsonEnvelope> {
  // `format: 'JSON'` returns the full envelope including a `statistics` block
  // with `rows_read` / `bytes_read`. This is the same data ClickHouse exposes
  // via the `X-ClickHouse-Summary` header and is the most reliable way to
  // measure a single query's scan footprint without relying on
  // `system.query_log` (which requires SYSTEM FLUSH LOGS and is async).
  const result = await ctx.clickhouse.query({ query: sql, format: "JSON" });
  return (await (result as any).json()) as ClickHouseJsonEnvelope;
}

function plantedQuery(found: TableRef, settings: string): string {
  return `SELECT productSku, orderTs, orderId, amount, itemDescription
FROM \`${found.database}\`.\`${found.table}\`
WHERE productSku = '42'
ORDER BY orderTs DESC
LIMIT 100
${settings}`;
}

async function getReadRows(
  ctx: AssertionContext,
  sql: string,
): Promise<number> {
  const envelope = await queryEnvelope(ctx, sql);
  return Number(envelope.statistics?.rows_read ?? 0);
}

export async function projection_reduces_rows_scanned_by_3x(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const baselineRows = await getReadRows(
    ctx,
    plantedQuery(found, "SETTINGS optimize_use_projections = 0"),
  );
  const projectedRows = await getReadRows(
    ctx,
    plantedQuery(found, "SETTINGS optimize_use_projections = 1"),
  );

  if (baselineRows === 0 || projectedRows === 0) {
    return {
      passed: false,
      message: `Could not measure rows_read from query statistics (baseline=${baselineRows}, projected=${projectedRows}). Did the query run?`,
      details: { baselineRows, projectedRows },
    };
  }

  const ratio = baselineRows / projectedRows;
  const passed = ratio >= 3.0;
  return {
    passed,
    message: passed
      ? `Projection cuts rows scanned by ${ratio.toFixed(1)}x: ${baselineRows} → ${projectedRows}.`
      : `Projection cuts rows scanned by only ${ratio.toFixed(1)}x: ${baselineRows} → ${projectedRows}. Need >= 3x. Either the projection isn't applied, isn't materialized for existing parts, or its ORDER BY doesn't match the query (must include productSku as the leading key).`,
    details: { baselineRows, projectedRows, ratio, threshold: 3.0 },
  };
}

export async function projection_appears_in_query_plan(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  // Discover the projection names the agent declared, so we can match them
  // by name in the EXPLAIN output regardless of what the agent named them.
  const projections = await queryRows<{ name: string }>(
    ctx,
    `SELECT name
     FROM system.projections
     WHERE database = '${found.database}' AND table = '${found.table}'`,
  );
  if (projections.length === 0) {
    return {
      passed: false,
      message: "No projections declared on the Orders table — nothing to verify in the query plan.",
      details: {},
    };
  }
  const projectionNames = projections.map((p) => p.name);

  const explainQuery = `EXPLAIN indexes = 1
SELECT productSku, orderTs, orderId, amount, itemDescription
FROM \`${found.database}\`.\`${found.table}\`
WHERE productSku = '42'
ORDER BY orderTs DESC
LIMIT 100
SETTINGS optimize_use_projections = 1`;

  const rows = await queryRows<{ explain: string }>(ctx, explainQuery);
  const planText = rows.map((r) => r.explain).join("\n");

  // When ClickHouse serves a query from a projection, the plan shows
  // `ReadFromMergeTree (<projection_name>)` instead of the table name.
  // Match by extracting the argument to ReadFromMergeTree and comparing
  // against the known projection names.
  const readFromMatches = Array.from(
    planText.matchAll(/ReadFromMergeTree\s*\(([^)]+)\)/g),
  )
    .map((m) => (m[1] ?? "").trim())
    .filter((s) => s.length > 0);
  const usedProjection = readFromMatches.find((target) =>
    projectionNames.includes(target),
  );
  const passed = Boolean(usedProjection);

  return {
    passed,
    message: passed
      ? `EXPLAIN shows the planted query is served from projection \`${usedProjection}\`.`
      : `EXPLAIN does not read from any declared projection (${projectionNames.join(", ")}); query is still reading the main table parts. ReadFromMergeTree targets: [${readFromMatches.join(", ") || "none"}].`,
    details: {
      projectionNames,
      readFromMatches,
      planSnippet: planText.split("\n").slice(0, 30).join("\n"),
    },
  };
}
