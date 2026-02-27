import type { AssertionContext } from "@dec-bench/eval-core";

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

export async function detects_null_event_ids(ctx: AssertionContext): Promise<boolean> {
  const nullCheck = await ctx.pg.query(
    "SELECT count(*) AS n FROM raw.events WHERE event_id IS NULL",
  );
  const nullCount = Number(nullCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) return false;

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();

  return nullCount === 5 && (resultText.includes("null") || resultText.includes("missing"));
}

export async function detects_duplicates(ctx: AssertionContext): Promise<boolean> {
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
  if (!table) return false;

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();

  return dupCount > 0 && (resultText.includes("duplicate") || resultText.includes("dup"));
}

export async function detects_schema_drift(ctx: AssertionContext): Promise<boolean> {
  const driftCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM raw.events
    WHERE properties ? 'device_type'
  `);
  const driftCount = Number(driftCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) return false;

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();

  return driftCount === 3 && (resultText.includes("schema") || resultText.includes("drift") || resultText.includes("device_type"));
}

export async function detects_stale_timestamps(ctx: AssertionContext): Promise<boolean> {
  const staleCheck = await ctx.pg.query(`
    SELECT count(*) AS n FROM raw.events
    WHERE event_ts < '2025-01-01T00:00:00Z'
  `);
  const staleCount = Number(staleCheck.rows[0]?.n ?? 0);

  const table = await findQualityTable(ctx);
  if (!table) return false;

  const results = await ctx.pg.query(`SELECT * FROM ${table}`);
  const resultText = JSON.stringify(results.rows).toLowerCase();

  return staleCount === 5 && (resultText.includes("stale") || resultText.includes("fresh") || resultText.includes("old") || resultText.includes("timestamp"));
}
