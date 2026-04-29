import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { fetchEgressJson, findEventsTable, findTable, resolveColumn } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function all_100_events_loaded(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 100;
  return {
    passed,
    message: passed ? "All 100 events loaded." : `Expected 100, got ${count}.`,
    details: { expected: 100, actual: count, location: `${found.database}.${found.table}` },
  };
}

export async function v1_events_have_unknown_region(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const regionCol = await resolveColumn(ctx, found.database, found.table, "region");
  if (!regionCol) {
    return { passed: false, message: "No region column found on events table.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE \`${regionCol}\` = 'unknown'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 60;
  return {
    passed,
    message: passed ? "60 v1 rows have region='unknown'." : `Expected 60 rows with region='unknown', got ${count}.`,
    details: { expected: 60, actual: count },
  };
}

export async function v2_events_have_real_region(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const regionCol = await resolveColumn(ctx, found.database, found.table, "region");
  if (!regionCol) {
    return { passed: false, message: "No region column found on events table.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE \`${regionCol}\` != 'unknown' AND \`${regionCol}\` != ''`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 40;
  return {
    passed,
    message: passed ? "40 v2 rows have actual region values." : `Expected 40 rows with real region, got ${count}.`,
    details: { expected: 40, actual: count },
  };
}

export async function daily_revenue_includes_region(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["daily", "revenue"] });
  if (!found) {
    return { passed: false, message: "No daily_revenue table found.", details: {} };
  }
  const regionCol = await resolveColumn(ctx, found.database, found.table, "region");
  if (!regionCol) {
    return { passed: false, message: `Table ${found.database}.${found.table} has no region column.`, details: { table: found } };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT uniqExact(\`${regionCol}\`) AS n FROM ${found.database}.${found.table}`,
  );
  const distinctRegions = Number(rows[0]?.n ?? 0);
  const passed = distinctRegions >= 2;
  return {
    passed,
    message: passed
      ? `Daily revenue has ${distinctRegions} distinct regions.`
      : `Expected at least 2 distinct regions, got ${distinctRegions}.`,
    details: { distinctRegions, table: `${found.database}.${found.table}` },
  };
}

export async function top_products_returns_correct_order(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEgressJson<any[]>(ctx, "top-products", { paths: ["/api/top-products?limit=3"] });
  const data = result?.data ?? null;
  if (!Array.isArray(data) || data.length < 3) {
    return {
      passed: false,
      message: `Expected 3 products, got ${Array.isArray(data) ? data.length : 0}.`,
      details: { data },
    };
  }
  const ids = data.map((r: any) => r.product_id ?? r.productId ?? r.id ?? "");
  const expectedTop3 = ["prod_F", "prod_B", "prod_D"];
  const passed = ids[0] === expectedTop3[0] && ids[1] === expectedTop3[1] && ids[2] === expectedTop3[2];
  return {
    passed,
    message: passed
      ? "Top 3 products are correctly ordered (prod_F, prod_B, prod_D)."
      : `Expected top 3 = [prod_F, prod_B, prod_D], got [${ids.join(", ")}].`,
    details: { expected: expectedTop3, actual: ids },
  };
}

export async function revenue_by_region_sums_match(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const regionCol = await resolveColumn(ctx, found.database, found.table, "region");
  const amountCol = await resolveColumn(ctx, found.database, found.table, "amount", "value", "revenue");
  const typeCol = await resolveColumn(ctx, found.database, found.table, "event_type", "eventType");
  if (!regionCol || !amountCol || !typeCol) {
    return {
      passed: false,
      message: "Could not resolve required columns (region, amount, event_type).",
      details: { regionCol, amountCol, typeCol },
    };
  }

  const chRows = await queryRows<{ region: string; total: number }>(
    ctx,
    `SELECT \`${regionCol}\` AS region, sum(\`${amountCol}\`) AS total
     FROM ${found.database}.${found.table}
     WHERE \`${typeCol}\` = 'purchase'
     GROUP BY region
     ORDER BY total DESC`,
  );
  const chByRegion: Record<string, number> = {};
  for (const row of chRows) {
    chByRegion[row.region] = Number(row.total);
  }

  const apiResult = await fetchEgressJson<any[]>(ctx, "revenue-by-region", { paths: ["/api/revenue-by-region"] });
  const apiData = apiResult?.data ?? null;
  if (!Array.isArray(apiData) || apiData.length === 0) {
    return { passed: false, message: "Revenue-by-region API returned empty or invalid data.", details: { chByRegion } };
  }

  const apiByRegion: Record<string, number> = {};
  for (const row of apiData) {
    const region = row.region ?? "";
    apiByRegion[region] = Number(row.total_revenue ?? row.totalRevenue ?? row.revenue ?? 0);
  }

  const allRegions = new Set([...Object.keys(chByRegion), ...Object.keys(apiByRegion)]);
  const mismatches: Array<{ region: string; ch: number; api: number }> = [];
  for (const region of allRegions) {
    const ch = chByRegion[region] ?? 0;
    const api = apiByRegion[region] ?? 0;
    if (Math.abs(ch - api) > 0.02) {
      mismatches.push({ region, ch, api });
    }
  }

  const passed = mismatches.length === 0 && allRegions.size >= 2;
  return {
    passed,
    message: passed
      ? "API revenue-by-region matches ClickHouse data."
      : `Mismatches: ${JSON.stringify(mismatches)}.`,
    details: { chByRegion, apiByRegion, mismatches },
  };
}
