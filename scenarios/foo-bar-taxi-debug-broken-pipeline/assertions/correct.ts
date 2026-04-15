import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_matches_raw_staging(ctx: AssertionContext): Promise<AssertionResult> {
  // Get raw staging counts
  const yellowRows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM raw.yellow_trips_2024_01`,
  );
  const greenRows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM raw.green_trips_2024_01`,
  );
  const expectedCount = Number(yellowRows[0]?.n ?? 0) + Number(greenRows[0]?.n ?? 0);

  // Get analytics count
  let analyticsCount = 0;
  try {
    const analyticsRows = await queryRows<{ n: number }>(
      ctx,
      `SELECT count() AS n FROM analytics.taxi_trips`,
    );
    analyticsCount = Number(analyticsRows[0]?.n ?? 0);
  } catch {
    return { passed: false, message: "Could not query analytics.taxi_trips.", details: {} };
  }

  const tolerance = expectedCount * 0.05;
  const passed = Math.abs(analyticsCount - expectedCount) <= tolerance;
  return {
    passed,
    message: passed
      ? `Analytics row count ${analyticsCount} matches raw staging ${expectedCount} (within 5%).`
      : `Analytics row count ${analyticsCount} does not match raw staging ${expectedCount}.`,
    details: { analyticsCount, expectedCount, tolerance },
  };
}

export async function api_returns_data_matching_clickhouse(ctx: AssertionContext): Promise<AssertionResult> {
  // Get ground truth from ClickHouse
  let chSummary: any;
  try {
    const rows = await queryRows<any>(
      ctx,
      `SELECT count() AS total_trips, sum(total_amount) AS total_revenue FROM analytics.taxi_trips`,
    );
    chSummary = rows[0];
  } catch {
    return { passed: false, message: "Could not query analytics.taxi_trips for ground truth.", details: {} };
  }

  // Query the API
  try {
    const resp = await fetch("http://localhost:3000/trips/summary");
    if (!resp.ok) {
      return { passed: false, message: `API /trips/summary returned HTTP ${resp.status}.`, details: {} };
    }
    const apiData = await resp.json() as any;
    const apiTrips = apiData.total_trips || apiData.totalTrips || apiData.count || 0;
    const chTrips = Number(chSummary.total_trips || 0);

    const tolerance = chTrips * 0.05;
    const passed = Math.abs(apiTrips - chTrips) <= tolerance;
    return {
      passed,
      message: passed
        ? `API total_trips ${apiTrips} matches ClickHouse ${chTrips} (within 5%).`
        : `API total_trips ${apiTrips} does not match ClickHouse ${chTrips}.`,
      details: { apiTrips, chTrips, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `API request failed: ${String(err)}`, details: {} };
  }
}
