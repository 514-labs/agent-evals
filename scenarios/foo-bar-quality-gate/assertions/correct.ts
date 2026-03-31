import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function findQualityTable(ctx: AssertionContext): Promise<string | null> {
  const pgCheck = await ctx.pg.query(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name LIKE '%quality%' OR table_name LIKE '%dq%' OR table_name LIKE '%check%'
    LIMIT 1
  `);
  if (pgCheck.rows.length > 0) {
    return `${pgCheck.rows[0].table_schema}.${pgCheck.rows[0].table_name}`;
  }
  return null;
}

export async function detects_null_event_ids(ctx: AssertionContext): Promise<AssertionResult> {
  const nullCheck = await ctx.pg.query(
    "SELECT count(*) AS n FROM raw.events WHERE event_id IS NULL",
  );
  const nullCount = Number(nullCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) {
    return { passed: false, message: "Quality table not found.", details: {} };
  }

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();
  const passed = nullCount === 5 && (resultText.includes("null") || resultText.includes("missing"));
  return {
    passed,
    message: passed ? "Detects null event IDs." : `Expected 5 nulls and quality flag; nullCount=${nullCount}.`,
    details: { nullCount, table },
  };
}

export async function detects_duplicates(ctx: AssertionContext): Promise<AssertionResult> {
  const dupCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM (
      SELECT event_id FROM raw.events
      WHERE event_id IS NOT NULL
      GROUP BY event_id, event_type, user_id, event_ts
      HAVING count(*) > 1
    ) AS dups
  `);
  const dupCount = Number(dupCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) {
    return { passed: false, message: "Quality table not found.", details: {} };
  }

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();
  const passed = dupCount > 0 && (resultText.includes("duplicate") || resultText.includes("dup"));
  return {
    passed,
    message: passed ? "Detects duplicates." : `dupCount=${dupCount}, quality flag missing.`,
    details: { dupCount, table },
  };
}

export async function detects_schema_drift(ctx: AssertionContext): Promise<AssertionResult> {
  const driftCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM raw.events
    WHERE properties ? 'device_type'
  `);
  const driftCount = Number(driftCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) {
    return { passed: false, message: "Quality table not found.", details: {} };
  }

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();
  const passed = driftCount === 3 && (resultText.includes("schema") || resultText.includes("drift") || resultText.includes("device_type"));
  return {
    passed,
    message: passed ? "Detects schema drift." : `driftCount=${driftCount}, quality flag missing.`,
    details: { driftCount, table },
  };
}

export async function detects_stale_timestamps(ctx: AssertionContext): Promise<AssertionResult> {
  const staleCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM raw.events
    WHERE event_ts < '2025-01-01T00:00:00Z'
  `);
  const staleCount = Number(staleCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) {
    return { passed: false, message: "Quality table not found.", details: {} };
  }

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();
  const passed = staleCount === 5 && (resultText.includes("stale") || resultText.includes("fresh") || resultText.includes("old") || resultText.includes("timestamp"));
  return {
    passed,
    message: passed ? "Detects stale timestamps." : `staleCount=${staleCount}, quality flag missing.`,
    details: { staleCount, table },
  };
}
